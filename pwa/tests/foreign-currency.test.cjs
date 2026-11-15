const test = require("node:test");
const assert = require("node:assert/strict");
const { convertForeignAmountToRial, calculateRealizedForeignExchange } = require("../foreign-currency.js");

test("converts foreign minor units to Rial using a whole-unit FX rate", () => {
 assert.deepEqual(convertForeignAmountToRial({currency:"USD",amountMinor:125050,fxRateRialPerUnit:600000}),{
  currency:"USD",amountMinor:125050,fxRateRialPerUnit:600000,rial:750300000
 });
});

test("rejects unsupported currency, fractional minor units and invalid rates", () => {
 assert.throws(()=>convertForeignAmountToRial({currency:"IRR",amountMinor:100,fxRateRialPerUnit:1}));
 assert.throws(()=>convertForeignAmountToRial({currency:"USD",amountMinor:1.5,fxRateRialPerUnit:600000}));
 assert.throws(()=>convertForeignAmountToRial({currency:"EUR",amountMinor:100,fxRateRialPerUnit:0}));
});

test("recognizes realized FX gain on a sales receivable when the rate rises", () => {
 const result=calculateRealizedForeignExchange({kind:"SALE",currency:"USD",invoiceAmountMinor:10000,settledAmountMinor:5000,invoiceFxRateRialPerUnit:500000,settlementFxRateRialPerUnit:600000});
 assert.equal(result.bookedRial,25000000);
 assert.equal(result.settlementRial,30000000);
 assert.equal(result.gainRial,5000000);
 assert.equal(result.lossRial,0);
});

test("recognizes realized FX loss on a foreign-currency purchase payable when the rate rises", () => {
 const result=calculateRealizedForeignExchange({kind:"PURCHASE",currency:"CNY",invoiceAmountMinor:10000,settledAmountMinor:10000,invoiceFxRateRialPerUnit:80000,settlementFxRateRialPerUnit:90000});
 assert.equal(result.gainRial,0);
 assert.equal(result.lossRial,1000000);
});

test("handles partial settlement and rejects settlement beyond invoice currency balance", () => {
 const result=calculateRealizedForeignExchange({kind:"PURCHASE",currency:"EUR",invoiceAmountMinor:10000,settledAmountMinor:2500,invoiceFxRateRialPerUnit:550000,settlementFxRateRialPerUnit:540000});
 assert.equal(result.bookedRial,13750000);
 assert.equal(result.settlementRial,13500000);
 assert.equal(result.gainRial,250000);
 assert.throws(()=>calculateRealizedForeignExchange({kind:"SALE",currency:"USD",invoiceAmountMinor:100,settledAmountMinor:101,invoiceFxRateRialPerUnit:500000,settlementFxRateRialPerUnit:600000}));
});
