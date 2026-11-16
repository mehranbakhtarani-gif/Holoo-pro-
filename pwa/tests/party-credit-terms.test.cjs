const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("sales invoice posting enforces an optional customer credit limit against the post-invoice receivable",()=>{
 assert.match(app,/const partyCreditLimit=Number\(p\.creditLimit\|\|0\)/);
 assert.match(app,/kind==="SALE"&&partyCreditLimit>0&&Math\.max\(0,nextPartyBalance\)>partyCreditLimit/);
 assert.match(app,/صدور فاکتور باعث عبور از سقف اعتبار مشتری می‌شود/);
});

test("zero credit limit remains unlimited and credit-day terms create a default due date when none is entered",()=>{
 assert.match(app,/partyCreditLimit>0/);
 assert.match(app,/dueDate:d\.dueDate\?new Date\(d\.dueDate\+"T12:00:00"\)\.getTime\(\):\(kind==="SALE"&&Number\(p\.creditDays\|\|0\)>0\?Date\.now\(\)\+Number\(p\.creditDays\)\*86400000:null\)/);
 assert.match(app,/مهلت تسویه \(روز؛ سررسید خودکار\)/);
});
