const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("date-only validation rejects malformed and normalized impossible calendar dates",()=>{
 assert.match(app,/function parseDateOnlyLocal\(value,label="تاریخ",endOfDay=false\)/);
 assert.match(app,/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
 assert.match(app,/parsed\.getFullYear\(\)!==year\|\|parsed\.getMonth\(\)!==month-1\|\|parsed\.getDate\(\)!==day/);
 assert.match(app,/parseDateOnlyLocal\(d\.validUntil,"تاریخ اعتبار پیش‌فاکتور",true\)/);
 assert.match(app,/parseDateOnlyLocal\(d\.due,"سررسید سفارش واردات"\)/);
 assert.match(app,/parseDateOnlyLocal\(d\.due,"سررسید چک"\),issue=parseDateOnlyLocal\(d\.issue,"تاریخ صدور چک"\)/);
});

test("sales-order create and edit enforce unique order numbers and stale draft guards atomically",()=>{
 assert.match(app,/function putSalesOrderGuarded\(record,expected=null\)/);
 assert.match(app,/db\.transaction\(\["salesOrders","auditLog"\],"readwrite"\)/);
 assert.match(app,/شماره سفارش تکراری است/);
 assert.match(app,/current\.status!=="DRAFT"\|\|!expected/);
 assert.match(app,/await putSalesOrderGuarded\(\{id:item\?\.id,number/);
 assert.match(app,/سفارش هم‌زمان تغییر کرده یا دیگر پیش‌نویس نیست/);
});

test("cheque numbers are normalized and uniqueness plus edit-state validation share one transaction",()=>{
 assert.match(app,/function putCheckUnique\(record,expected=null\)/);
 assert.match(app,/db\.transaction\(\["checks","auditLog"\],"readwrite"\)/);
 assert.match(app,/normalize\("NFKC"\)\.toLocaleUpperCase\("fa"\)/);
 assert.match(app,/شماره چک تکراری است/);
 assert.match(app,/current\.status!=="OPEN"\|\|!expected/);
 assert.match(app,/await putCheckUnique\(\{id:item\?\.id,number,kind/);
 assert.doesNotMatch(app,/const existing=await all\("checks"\);if\(existing\.some\(x=>String\(x\.number\)===number/);
});
