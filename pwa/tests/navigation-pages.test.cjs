const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("every enabled management tab has a page renderer",()=>{
 for(const key of ["approvals","employees","payroll","fixedAssets","allocations","depreciations"])
  assert.ok(app.includes('if(currentPage==="'+key+'")'),"missing renderer for "+key);
});

test("employee and asset deletion are blocked when accounting history exists",()=>{
 assert.match(app,/payroll\.some\(x=>Number\(x\.employeeId\)===key\)/);
 assert.match(app,/depreciations\.some\(x=>Number\(x\.assetId\)===key\)/);
});

 
test("fixed asset purchase posts to fixed assets and the selected payment or payable account",()=>{
 assert.ok(app.includes('["1501","دارایی ثابت مشهود","ASSET"]'));
 assert.ok(app.includes('["paymentMethod","روش پرداخت","select",1,["بانک","صندوق","نسیه"]]'));
 assert.match(app,/accountCode:"1501",debitRial:cost/);
 assert.match(app,/FIXED-ASSET:/);
});

test("depreciation posting uses a stale-state guard and protects posted assets from deletion",()=>{
 assert.match(app,/assetSnapshot=\{accumulatedDepreciation:asset\.accumulatedDepreciation,netBookValue:asset\.netBookValue\}/);
 assert.match(app,/expected:assetSnapshot/);
 assert.match(app,/asset\?\.purchaseVoucherReference/);
});

 
test("paid payroll posts a matching treasury payment while calculated payroll remains payable",()=>{
 assert.ok(app.includes('["paymentMethod","روش پرداخت در صورت تسویه","select",1,["بانک","صندوق"]]'));
 assert.match(app,/status==="پرداخت‌شده"&&net>0\)entries\.push\(\["treasury",\{kind:"PAYMENT"/);
 assert.match(app,/paymentMethod==="صندوق"\?"1101":"1102"/);
});

 
test("calculated payroll can be paid later through a guarded treasury transaction",()=>{
 assert.match(app,/async function payPayrollPwa/);
 assert.match(app,/PAYROLL-PAYMENT:/);
 assert.match(app,/data-payroll-pay/);
 const operationDate=fs.readFileSync(path.resolve(__dirname,"../operation-date.js"),"utf8");
 assert.match(operationDate,/payroll:\["createdAt","paidAt"\]/);
});

 
test("approval requests must reference an existing document and support explicit approve/reject actions",()=>{
 assert.match(app,/سند مرجع با نوع و شناسه انتخاب‌شده پیدا نشد/);
 assert.match(app,/برای این سند و مرحله قبلاً درخواست تأیید ثبت شده است/);
 assert.match(app,/data-approval-status=/);
});
