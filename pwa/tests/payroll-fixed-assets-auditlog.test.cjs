const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("payroll period is normalized and validated as a real year/month",()=>{
 assert.match(app,/function normalizeAccountingPeriod\(value,label="دوره"\)/);
 assert.match(app,/replace\(\/\[۰-۹\]\/g,digit=>String\("۰۱۲۳۴۵۶۷۸۹"\.indexOf\(digit\)\)\)/);
 assert.match(app,/\/\^\\d\{4\}\\\/\(0\[1-9\]\|1\[0-2\]\)\$\//);
 assert.match(app,/period=normalizeAccountingPeriod\(d\.period,"دوره حقوق"\)/);
 assert.match(app,/period=normalizeAccountingPeriod\(d\.period,"دوره استهلاک"\)/);
});

test("payroll posting prevents duplicate employee-period entries inside the accounting transaction",()=>{
 assert.match(app,/\{store:"payroll",match:\{employeeId:Number\(employee\.id\),period\},expected:null\}/);
 assert.match(app,/status==="پرداخت‌شده"&&net>0&&!paymentAccount/);
 assert.match(app,/accountCode:status==="پرداخت‌شده"\?paymentAccountCode:"2104"/);
 assert.match(app,/treasury=\{kind:"PAYMENT",method:paymentMethod,accountCode:paymentAccountCode,accountName:paymentAccount\.title/);
});

test("later payroll payment uses a selected cash or bank subaccount and preserves it in treasury",()=>{
 assert.match(app,/eligible=accounts\.filter\(a=>a\.type==="ASSET"&&\/\^110\[12\]\\d\*\$\//);
 assert.match(app,/account=eligible\.find\(a=>String\(a\.id\)===String\(code\)\.trim\(\)\)/);
 assert.match(app,/accountCode=account\?String\(account\.id\):""/);
 assert.match(app,/accountName:account\.title/);
 assert.match(app,/\{accountCode,debitRial:0,creditRial:net/);
});

test("fixed-asset purchase uses a selected subaccount and validates acquisition date",()=>{
 assert.match(app,/\["paymentAccountCode","حساب صندوق \/ بانک","select"\]/);
 assert.match(app,/paymentMethod!=="نسیه"&&!paymentAccount/);
 assert.match(app,/accountCode=paymentAccountCode,method=paymentMethod/);
 assert.match(app,/accountName:paymentAccount\.title/);
 assert.match(app,/parseDateOnlyLocal\(d\.acquired,"تاریخ خرید دارایی"\)/);
});

test("depreciation is period-normalized, duplicate-guarded and bounded by depreciable value",()=>{
 assert.match(app,/accumulated\+amount>depreciable/);
 assert.match(app,/store:"assetDepreciations",match:\{assetId:Number\(asset\.id\),period\},expected:null/);
});

test("audit log page is read-only and presents newest activity first",()=>{
 assert.match(app,/if\(currentPage==="auditLog"\)\{const logs=\(await all\("auditLog"\)\)/);
 assert.match(app,/sort\(\(a,b\)=>Number\(b\.at\)-Number\(a\.at\)\)/);
 assert.match(app,/table\(\["زمان","عملیات","بخش","شناسه","شرح"\]/);
});
