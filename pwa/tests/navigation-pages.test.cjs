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
