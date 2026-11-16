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
