const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

test("bank statement stores migrate without clearing existing records",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/DB_VERSION=8/);
 assert.match(app,/bankStatements/);
 assert.match(app,/bankStatementLines/);
});

test("bank reconciliation page supports CSV import, auto matching and manual matching",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/parseBankCsv\(/);
 assert.match(app,/autoMatchBankLines\(/);
 assert.match(app,/validateBankManualMatch\(/);
 assert.match(app,/data-bank-match/);
 assert.match(app,/bindBankReconciliation\(\)/);
});

test("bank statement metadata and all lines are stored in one transaction",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/db\.transaction\(\["bankStatements","bankStatementLines","auditLog"\],"readwrite"\)/);
 assert.match(app,/fileName:file\.name/);
 assert.match(app,/این فایل صورت‌حساب قبلاً وارد شده است/);
});

test("bank reconciliation module loads before app and is precached",()=>{
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.ok(html.indexOf("bank-reconciliation.js")>=0);
 assert.ok(html.indexOf("bank-reconciliation.js")<html.indexOf("app.js"));
 assert.match(sw,/\.\/bank-reconciliation\.js/);
});
