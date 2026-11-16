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
 assert.ok(app.includes('["paymentAccountCode","حساب صندوق / بانک در صورت پرداخت","select"]'));
 assert.match(app,/status==="پرداخت‌شده"&&net>0\)entries\.push\(\["treasury",\{kind:"PAYMENT"/);
 assert.match(app,/\{accountCode,debitRial:0,creditRial:net/);\n assert.match(app,/accountCode:account,accountName:account\.title/);
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


test("all enabled pages are generated into desktop and mobile navigation and have render branches",()=>{
 const match=app.match(/const titles=\{([\s\S]*?)\};/);
 assert.ok(match,"page title registry exists");
 const keys=[...match[1].matchAll(/([A-Za-z][A-Za-z0-9]*):\[/g)].map(x=>x[1]);
 for(const key of keys)assert.ok(app.includes('if(currentPage==="' + key + '")'),"missing page renderer: "+key);
 assert.match(app,/Object\.keys\(titles\)\.filter\(k=>k!=="foreignPayablePayments"\)/);
 assert.match(app,/\$\("#sidebar"\)\.innerHTML=items/);
 assert.match(app,/\$\("#mobileNav"\)\.innerHTML=items/);
});

 
test("approval decisions revalidate pending status and update timestamp atomically",()=>{
 assert.match(app,/const snapshot=\{status:row\.status,updatedAt:row\.updatedAt\};await putManyGuarded\(\[\["approvals",\{\.\.\.row,status,updatedAt:Date\.now\(\)\}\]\],\[\{store:"approvals",key:Number\(row\.id\),expected:snapshot\}\]\)/);
});
