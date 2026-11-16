const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("bank reconciliation supports search and unmatching an incorrect match",()=>{
 assert.match(app,/جست‌وجوی بانک، شرح، مرجع یا مبلغ/);
 assert.match(app,/data-bank-unmatch/);
 assert.match(app,/async function unmatchBankStatementLine/);
 assert.match(app,/line\.status="UNMATCHED";line\.matchedTreasuryId=null;line\.matchedAt=null/);
});

test("unmatching a bank line is audited",()=>{
 assert.match(app,/لغو تطبیق صورت‌حساب بانکی/);
});

test("bank reconciliation exports statement lines and matched treasury trace to CSV",()=>{
 assert.match(app,/id="exportBankReconciliationCsv"/);
 assert.match(app,/holloo-bank-reconciliation\.csv/);
 assert.match(app,/شناسه گردش خزانه/);
 assert.match(app,/line\.matchedTreasuryId/);
});

test("bank reconciliation export loads its own line records before generating the file",()=>{
 assert.match(app,/exportBankReconciliation\.onclick=async\(\)=>\{try\{const lines=await all\("bankStatementLines"\)/);
});
