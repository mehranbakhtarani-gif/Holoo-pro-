const test = require("node:test");
const assert = require("node:assert/strict");
const { convertForeignAmountToRial, convertRialToForeignMinor, calculateRealizedForeignExchange, calculateCumulativeRealizedForeignExchange, buildRealizedForeignExchangeRows } = require("../foreign-currency.js");

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
   assert.ok(Math.abs(restored-minor)<=Math.ceil(50/rate+0.5),JSON.stringify({rate,minor,rial,restored}));
  }
 }
});
test("rejects unsafe inverse conversions and unsafe realized FX differences",()=>{
 assert.throws(()=>convertRialToForeignMinor({currency:"USD",rial:Number.MAX_SAFE_INTEGER,fxRateRialPerUnit:1}));
 assert.throws(()=>calculateRealizedForeignExchange({kind:"SALE",currency:"USD",invoiceAmountMinor:Number.MAX_SAFE_INTEGER,settledAmountMinor:Number.MAX_SAFE_INTEGER,invoiceFxRateRialPerUnit:1,settlementFxRateRialPerUnit:Number.MAX_SAFE_INTEGER}));
});

test("PWA invoice and order totals use the exact inverse FX converter",()=>{
 const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"..");
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.equal((app.match(/convertRialToForeignMinor\(\{currency,rial:total,fxRateRialPerUnit:fxRate\}\)/g)||[]).length,2);
 assert.match(html,/foreign-currency\.js\?v=fx-cumulative-settlement-3/);
 assert.match(html,/app\.js\?v=fx-allocation-residual-3/);
 assert.match(sw,/holloo-pwa-v173-fx-settlement-guard/);
});

test("cumulative FX settlement assigns rounding residuals so invoice and treasury totals reconcile exactly",()=>{
 const invoiceTotal=convertForeignAmountToRial({currency:"USD",amountMinor:1000,fxRateRialPerUnit:600001}).rial;
 const treasuryTotal=convertForeignAmountToRial({currency:"USD",amountMinor:1000,fxRateRialPerUnit:650000}).rial;
 let invoiceMinor=0,invoiceBooked=0,treasuryMinor=0,treasurySettled=0,gain=0;
 for(const amount of [333,333,334]){
  const row=calculateCumulativeRealizedForeignExchange({kind:"SALE",currency:"USD",invoiceAmountMinor:1000,settledAmountMinor:amount,previousInvoiceSettledMinor:invoiceMinor,previousInvoiceBookedRial:invoiceBooked,invoiceTotalRial:invoiceTotal,invoiceFxRateRialPerUnit:600001,treasuryAmountMinor:1000,previousTreasurySettledMinor:treasuryMinor,previousTreasurySettlementRial:treasurySettled,treasuryTotalRial:treasuryTotal,settlementFxRateRialPerUnit:650000});
  invoiceMinor+=amount;invoiceBooked+=row.bookedRial;treasuryMinor+=amount;treasurySettled+=row.settlementRial;gain+=row.gainRial;
 }
 assert.equal(invoiceMinor,1000);assert.equal(treasuryMinor,1000);
 assert.equal(invoiceBooked,invoiceTotal);assert.equal(treasurySettled,treasuryTotal);
 assert.equal(gain,treasuryTotal-invoiceTotal);
});

test("cumulative FX settlement rejects over-settlement and inconsistent prior book values",()=>{
 assert.throws(()=>calculateCumulativeRealizedForeignExchange({kind:"SALE",currency:"USD",invoiceAmountMinor:100,settledAmountMinor:101,invoiceTotalRial:600000,invoiceFxRateRialPerUnit:600000,treasuryAmountMinor:100,treasuryTotalRial:650000,settlementFxRateRialPerUnit:650000}));
 assert.throws(()=>calculateCumulativeRealizedForeignExchange({kind:"SALE",currency:"USD",invoiceAmountMinor:100,settledAmountMinor:50,previousInvoiceSettledMinor:50,previousInvoiceBookedRial:700000,invoiceTotalRial:600000,invoiceFxRateRialPerUnit:600000,treasuryAmountMinor:100,treasuryTotalRial:650000,settlementFxRateRialPerUnit:650000}));
});

test("realized FX report excludes reversed allocations and reversed payable payments",()=>{
 const rows=buildRealizedForeignExchangeRows({
  allocations:[
   {id:1,invoiceNumber:"INV-A",fxGainRial:500,fxLossRial:0,date:10,status:"ACTIVE"},
   {id:2,invoiceNumber:"INV-B",fxGainRial:700,fxLossRial:0,date:30,status:"REVERSED"},
   {id:3,invoiceNumber:"INV-C",fxGainRial:0,fxLossRial:200,date:20}
  ],
  foreignPayments:[
   {id:4,sourceNumber:"PAY-A",fxGainRial:0,fxLossRial:300,date:40,status:"ACTIVE"},
   {id:5,sourceNumber:"PAY-B",fxGainRial:900,fxLossRial:0,date:50,status:"REVERSED"},
   {id:6,sourceNumber:"PAY-C",fxGainRial:0,fxLossRial:0,date:60,status:"ACTIVE"}
  ]
 });
 assert.deepEqual(rows.map(x=>x.id),[4,3,1]);
 assert.equal(rows.reduce((n,x)=>n+Number(x.fxGainRial||0),0),500);
 assert.equal(rows.reduce((n,x)=>n+Number(x.fxLossRial||0),0),500);
});

test("realized FX report does not mutate original settlement history",()=>{
 const allocations=[{id:7,status:"REVERSED",fxGainRial:120,date:1}],payments=[{id:8,status:"ACTIVE",fxLossRial:40,date:2}];
 const before=JSON.stringify({allocations,payments});
 buildRealizedForeignExchangeRows({allocations,foreignPayments:payments});
 assert.equal(JSON.stringify({allocations,payments}),before);
});
