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

const accountingReports=require("../accounting-reports.js");
test("financial statements reject voucher lines without a parent voucher",()=>{assert.throws(()=>accountingReports.buildFinancialStatements({accounts:[{id:"1001",type:"ASSET"}],vouchers:[],voucherLines:[{voucherId:99,accountCode:"1001",debitRial:10,creditRial:0}]}),/بدون سند حسابداری مرجع/)});
test("financial statements reject account codes missing from the chart",()=>{assert.throws(()=>accountingReports.buildFinancialStatements({accounts:[{id:"1001",type:"ASSET"}],vouchers:[{id:1,date:1}],voucherLines:[{voucherId:1,accountCode:"9999",debitRial:10,creditRial:0}]}),/در سرفصل حساب‌ها تعریف نشده/)});
test("period closing rejects orphan and unknown-account voucher lines",()=>{const accounts=[{id:"3201",type:"EQUITY",title:"سود انباشته"}];assert.throws(()=>accountingReports.buildPeriodClosingJournal({accounts,vouchers:[],voucherLines:[{voucherId:99,accountCode:"3201",debitRial:1,creditRial:0}],fromDate:0,toDate:10}),/بدون سند حسابداری مرجع/);assert.throws(()=>accountingReports.buildPeriodClosingJournal({accounts,vouchers:[{id:1,date:5}],voucherLines:[{voucherId:1,accountCode:"9999",debitRial:1,creditRial:0}],fromDate:0,toDate:10}),/در سرفصل حساب‌ها تعریف نشده/)});
test("general ledger refuses orphan voucher lines and unknown account codes",()=>{const accounts=[{id:"1001",openingDebitRial:0,openingCreditRial:0}];assert.throws(()=>accountingReports.buildLedgerRunningRows({accounts,rows:[{accountCode:"1001",orphanVoucherLine:true,debit:1,credit:0}]}),/بدون سند حسابداری مرجع/);assert.throws(()=>accountingReports.buildLedgerRunningRows({accounts,rows:[{accountCode:"9999",debit:1,credit:0}]}),/در سرفصل حساب‌ها تعریف نشده/)});
test("app general ledger preserves orphan rows for explicit failure instead of filtering them out",()=>{assert.match(app,/orphanVoucherLine:true/);assert.doesNotMatch(app,/\}\)\.filter\(Boolean\)\.sort\(\(a,b\)=>b\.date-a\.date\)/)});
