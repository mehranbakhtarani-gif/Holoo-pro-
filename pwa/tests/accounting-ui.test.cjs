const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("account creation and edit buttons report form-opening failures",()=>{
 assert.match(app,/newAccountButton\.onclick=\(\)=>openForm\("accounts"\)\.catch\(e=>toast\(e\.message\|\|"فرم حساب باز نشد"\)\)/);
 assert.match(app,/await openForm\("accounts",item\)/);
 assert.match(app,/فرم ویرایش حساب باز نشد/);
});


test("accounting reports wire trial balance, aging print, CSV and ledger filters",()=>{
 assert.match(app,/trialBalanceColumns\.addEventListener\("change",updateTrialBalance\)/);
 assert.match(app,/agingPrintButton\.onclick=/);
 assert.match(app,/exportLedger\.onclick=/);
 assert.match(app,/printLedger\.onclick=/);
 assert.match(app,/\["ledgerAccountFilter","ledgerFrom","ledgerTo"\]\.forEach\(id=>\{const el=\$\("#"\+id\);if\(el\)el\.addEventListener\("change",ledgerFilter\)\}\)/);
 assert.match(app,/exportFinance\.onclick=/);
});

test("accounting manual vouchers and opening balances have submit handlers and balance guards",()=>{
 assert.match(app,/\$\("#addVoucherLine"\)\.onclick=addVoucherRow/);
 assert.match(app,/manualForm\.onsubmit=async/);
 assert.match(app,/openingForm\.onsubmit=async/);
 assert.match(app,/debit!==credit/);
 assert.match(app,/vouchers\.length\).*مانده افتتاحیه پس از ثبت اولین سند قفل است/);
});

 
test("accounting sales reports exclude draft and reversed invoices but retain legacy posted records",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.ok(app.includes('const sales=invoices.filter(x=>x.kind==="SALE"&&(!x.status||x.status==="POSTED"));'));
});

 
test("accounting page exposes an apply/clear date range for financial statements and trial balance",()=>{
 assert.match(app,/id="accountingFromDate"/);
 assert.match(app,/id="accountingToDate"/);
 assert.match(app,/id="applyAccountingDateRange"/);
 assert.match(app,/id="clearAccountingDateRange"/);
 assert.match(app,/parseDateBoundaryLocal\(accountingFromDate,"از تاریخ"\)/);
 assert.match(app,/parseDateBoundaryLocal\(accountingToDate,"تا تاریخ",true\)/);
});
