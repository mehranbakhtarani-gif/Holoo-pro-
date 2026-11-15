const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { calculateImportShipmentCost } = require("../import-cost.js");
const { getInvoiceSettlement, validateTreasuryAllocation } = require("../settlement.js");
const root = path.resolve(__dirname, "..");

test("calculates converted goods cost, landed cost and cost per kg", () => {
  const result = calculateImportShipmentCost({
    currency: "USD", fx: 50000, goods: 1000, weight: 25000,
    freight: 1000000, customs: 400000, other: 100000
  });
  assert.deepEqual(result, {
    goodsRial: 50000000, totalCost: 51500000, unitCost: 2060
  });
});

test("rejects unsupported currencies and invalid base values", () => {
  assert.throws(() => calculateImportShipmentCost({currency:"IRR",fx:1,goods:1,weight:1}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:0,goods:1,weight:1}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:1,goods:0,weight:1}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:1,goods:1,weight:0}));
});

test("rejects negative, fractional or overflowing ancillary costs", () => {
  assert.throws(() => calculateImportShipmentCost({currency:"CNY",fx:1,goods:1,weight:1,freight:-1}));
  assert.throws(() => calculateImportShipmentCost({currency:"EUR",fx:1,goods:1,weight:1,customs:1.5}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:Number.MAX_SAFE_INTEGER,goods:2,weight:1}));
});

test("PWA loads the helper before app code and precaches it", () => {
  const html = fs.readFileSync(path.join(root,"index.html"),"utf8");
  const sw = fs.readFileSync(path.join(root,"sw.js"),"utf8");
  assert.ok(html.indexOf("import-cost.js") >= 0);
  assert.ok(html.indexOf("import-cost.js") < html.indexOf("app.js"));
  assert.match(sw, /\.\/import-cost\.js/);
  assert.match(fs.readFileSync(path.join(root,"app.js"),"utf8"), /calculateImportShipmentCost/);
});

test("derives paid, outstanding and settlement status from allocations", () => {
  const invoice = {number:"S-1",total:1000};
  assert.deepEqual(getInvoiceSettlement(invoice,[{invoiceNumber:"S-1",amount:350}]),{paid:350,outstanding:650,status:"PARTIAL"});
  assert.deepEqual(getInvoiceSettlement(invoice,[{invoiceNumber:"S-1",amount:1000}]),{paid:1000,outstanding:0,status:"PAID"});
  assert.equal(getInvoiceSettlement({...invoice,status:"REVERSED"},[]).status,"REVERSED");
});

test("accepts valid same-party receipt allocation to a sales invoice", () => {
  assert.equal(validateTreasuryAllocation({
    transaction:{id:7,kind:"RECEIPT",partyId:2,amount:800},
    invoice:{number:"S-2",kind:"SALE",partyId:2,total:500},
    amount:500,allocations:[]
  }),true);
});

test("rejects mismatched parties, wrong direction and over-allocation", () => {
  const transaction={id:7,kind:"RECEIPT",partyId:2,amount:800};
  const invoice={number:"S-3",kind:"SALE",partyId:2,total:500};
  assert.throws(()=>validateTreasuryAllocation({transaction,invoice:{...invoice,partyId:9},amount:100,allocations:[]}));
  assert.throws(()=>validateTreasuryAllocation({transaction:{...transaction,kind:"PAYMENT"},invoice,amount:100,allocations:[]}));
  assert.throws(()=>validateTreasuryAllocation({transaction,invoice,amount:801,allocations:[]}));
  assert.throws(()=>validateTreasuryAllocation({transaction,invoice,amount:501,allocations:[]}));
  assert.throws(()=>validateTreasuryAllocation({transaction,invoice:{...invoice,status:"REVERSED"},amount:100,allocations:[]}));
});

test("editing an allocation excludes its previous value from limits", () => {
  assert.equal(validateTreasuryAllocation({
    transaction:{id:7,kind:"RECEIPT",partyId:2,amount:500},
    invoice:{number:"S-4",kind:"SALE",partyId:2,total:500},
    amount:500,currentAllocationId:10,
    allocations:[{id:10,treasuryId:7,invoiceNumber:"S-4",amount:500}]
  }),true);
});
