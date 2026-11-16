const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("treasury page shows gross inflow, outflow and net movement summaries",()=>{
 assert.match(app,/گردش دریافت/);
 assert.match(app,/گردش پرداخت/);
 assert.match(app,/خالص گردش/);
});

test("treasury ledger supports search and exposes reference and reversal status",()=>{
 assert.match(app,/جست‌وجوی شناسه، طرف حساب، روش، ارز، مبلغ، تاریخ یا شرح/);
 assert.match(app,/x\.id,x\.partyName,x\.method,x\.currency,x\.note,x\.reference,x\.status,x\.kind==="RECEIPT"\?"دریافت":"پرداخت",x\.amount,fmt\(x\.amount\|\|0\),x\.foreignAmountMinor\?fmtForeign\(x\.foreignAmountMinor\/100\):"",date\(x\.date\)/);
 assert.match(app,/برگشت‌شده/);
});

 
test("standalone treasury entries expose a guarded reversal action",()=>{
 assert.match(app,/async function reverseTreasuryPwa/);
 assert.match(app,/data-treasury-reverse/);
 assert.match(app,/treasuryAllocations",match:\{treasuryId:Number\(original\.id\)\},expected:null/);
 assert.match(app,/applyPartyBalanceDelta\(party,original\.kind==="RECEIPT"\?/);
});

test("treasury ledger exports currency, FX, Rial amount, reference and reversal status",()=>{
 assert.match(app,/id="exportTreasuryCsv"/);
 assert.match(app,/holloo-treasury\.csv/);
 assert.match(app,/fxRateRialPerUnit/);
 assert.match(app,/مبلغ ارزی/);
 assert.match(app,/برگشت‌شده/);
});
