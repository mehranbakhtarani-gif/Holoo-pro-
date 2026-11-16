const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("opening balances are locked after the first posted voucher",()=>{
 assert.match(app,/const vouchers=await all\("vouchers"\);if\(vouchers\.length\)/);
 assert.match(app,/مانده افتتاحیه پس از ثبت اولین سند قفل است/);
});

test("manual vouchers cannot bypass cash, bank and party control ledgers",()=>{
 assert.match(app,/\["1101","1102","1103","2101"\]\.includes\(String\(x\.accountCode\)\)/);
});

test("system control account types cannot be changed from the chart editor",()=>{
 assert.match(app,/typeField\.disabled=true/);
});

 
test("manual voucher and opening balance writes verify account snapshots atomically",()=>{
 assert.match(app,/const accountGuards=rows\.map/);
 assert.match(app,/postVoucherAtomic\(\[\],\{number:voucherNumber/);
 assert.match(app,/await putManyGuarded\(updates\.map\(a=>\["accounts",a\]\),guards\)/);
});
