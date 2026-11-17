const test = require("node:test");
const assert = require("node:assert/strict");
const { convertForeignAmountToRial, convertRialToForeignMinor, calculateRealizedForeignExchange } = require("../foreign-currency.js");

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

test("uses exact integer arithmetic when the intermediate product exceeds safe integer precision",()=>{
 const amount=Number.MAX_SAFE_INTEGER;
 assert.equal(convertForeignAmountToRial({currency:"USD",amountMinor:amount,fxRateRialPerUnit:100}).rial,amount);
 assert.equal(convertRialToForeignMinor({currency:"USD",rial:amount,fxRateRialPerUnit:100}),amount);
});
test("rounds half-minor conversions consistently and preserves round-trip within one minor unit",()=>{
 assert.equal(convertForeignAmountToRial({currency:"USD",amountMinor:1,fxRateRialPerUnit:50}).rial,1);
 assert.equal(convertRialToForeignMinor({currency:"USD",rial:1,fxRateRialPerUnit:200}),1);
 for(const rate of [1,3,7,99,100,101,550000,999999]){
  for(const minor of [1,2,99,100,101,12345]){
   const rial=convertForeignAmountToRial({currency:"EUR",amountMinor:minor,fxRateRialPerUnit:rate}).rial;
   const restored=convertRialToForeignMinor({currency:"EUR",rial,fxRateRialPerUnit:rate});
   assert.ok(Math.abs(restored-minor)<=1,JSON.stringify({rate,minor,rial,restored}));
  }
 }
});
test("rejects unsafe inverse conversions and unsafe realized FX differences",()=>{
 assert.throws(()=>convertRialToForeignMinor({currency:"USD",rial:Number.MAX_SAFE_INTEGER,fxRateRialPerUnit:1}));
 assert.throws(()=>calculateRealizedForeignExchange({kind:"SALE",currency:"USD",invoiceAmountMinor:Number.MAX_SAFE_INTEGER,settledAmountMinor:Number.MAX_SAFE_INTEGER,invoiceFxRateRialPerUnit:1,settlementFxRateRialPerUnit:Number.MAX_SAFE_INTEGER}));
});
