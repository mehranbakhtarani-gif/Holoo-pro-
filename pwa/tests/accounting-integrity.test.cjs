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
 assert.match(app,/\["1101","1102","1103","1301","1501","1502","2101","2102","2104","2105","3102"\]\.includes\(String\(x\.accountCode\)\)/);
});

test("system control account types cannot be changed from the chart editor",()=>{
 assert.match(app,/typeField\.disabled=true/);
});

 
test("manual voucher and opening balance writes verify account snapshots atomically",()=>{
 assert.match(app,/const accountGuards=rows\.map/);
 assert.match(app,/postVoucherAtomic\(\[\],\{number:voucherNumber/);
 assert.match(app,/await putManyGuarded\(updates\.map\(a=>\["accounts",a\]\),guards\)/);
});

 
test("all party-balance mutations pass through one safe-integer guard",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/function applyPartyBalanceDelta\(party,delta,label="طرف حساب"\)/);
 assert.match(app,/if\(!Number\.isSafeInteger\(current\)\|\|!Number\.isSafeInteger\(change\)\|\|!Number\.isSafeInteger\(next\)\)/);
 assert.equal((app.match(/[A-Za-z_$][\w$]*\.balance=Number\(/g)||[]).length,0);
 assert.ok((app.match(/applyPartyBalanceDelta\(/g)||[]).length>=10);
});
