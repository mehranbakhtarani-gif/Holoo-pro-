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
 assert.match(app,/جست‌وجوی طرف حساب، روش، ارز یا شرح/);
 assert.match(app,/x\.reference,x\.status/);
 assert.match(app,/برگشت‌شده/);
});
