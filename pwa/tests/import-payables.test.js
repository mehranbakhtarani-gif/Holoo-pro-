"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createImportCharge,
  planImportChargePayment,
  planImportChargeReversal,
  reconcileImportCharges
} = require("../import-payables.js");

function charge(overrides = {}) {
  return createImportCharge({
    shipmentId: 7,
    supplierId: 4,
    amountRial: 1000,
    category: "freight",
    reference: "IMPORT-CHARGE:7:freight",
    date: 1,
    ...overrides
  });
}

test("supports multiple installments until the payable is fully paid", () => {
  const original = charge();
  const first = planImportChargePayment({
    charge: original, amountRial: 400, paymentReference: "PAY-1", date: 2
  });
  assert.equal(first.updated.paidRial, 400);
  assert.equal(first.updated.status, "PARTIAL");

  const second = planImportChargePayment({
    charge: first.updated, amountRial: 600, paymentReference: "PAY-2", date: 3
  });
  assert.equal(second.updated.paidRial, 1000);
  assert.equal(second.updated.status, "PAID");
  assert.equal(second.remainingRial, 0);
  assert.equal(original.paidRial, 0, "planning must not mutate the source record");
});

test("reverses one installment without losing the remaining paid balance", () => {
  const first = planImportChargePayment({
    charge: charge(), amountRial: 400, paymentReference: "PAY-1", date: 2
  });
  const second = planImportChargePayment({
    charge: first.updated, amountRial: 600, paymentReference: "PAY-2", date: 3
  });
  const reversed = planImportChargeReversal({
    charge: second.updated, payment: second.payment, date: 4
  });
  assert.equal(reversed.updated.paidRial, 400);
  assert.equal(reversed.updated.status, "PARTIAL");
  assert.equal(reversed.reversedPayment.status, "REVERSED");

  const reconciliation = reconcileImportCharges({
    charges: [reversed.updated],
    payments: [first.payment, reversed.reversedPayment]
  });
  assert.equal(reconciliation.ok, true);
  assert.deepEqual(reconciliation.errors, []);
});

test("rejects overpayment and invalid charge amounts", () => {
  assert.throws(() => planImportChargePayment({
    charge: charge(), amountRial: 1001, paymentReference: "OVERPAY"
  }));
  assert.throws(() => charge({ amountRial: -1 }));
});

test("reconciliation detects orphaned and mismatched payments", () => {
  const result = reconcileImportCharges({
    charges: [charge()],
    payments: [
      { id: 1, reference: "PAY-1", chargeReference: "MISSING", shipmentId: 7, supplierId: 4, amountRial: 100, status: "POSTED" },
      { id: 2, reference: "PAY-2", chargeReference: "IMPORT-CHARGE:7:freight", shipmentId: 8, supplierId: 4, amountRial: 100, status: "POSTED" }
    ]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.type === "ORPHAN_PAYMENT"));
  assert.ok(result.errors.some(error => error.type === "PAYMENT_LINK_MISMATCH"));
});
