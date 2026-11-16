const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("treasury form offers every active asset subaccount under cash and bank control accounts",()=>{
 assert.match(app,/\["accountCode","حساب صندوق \/ بانک","select",1\]/);
 assert.match(app,/a\.type==="ASSET"&&\/\^110\[12\]\\d\*\$\//);
 assert.match(app,/fields\.treasury\.find\(x=>x\[0\]==="accountCode"\)\[4\]=cashBankAccounts\.map/);
 assert.match(app,/accountCode.startsWith\("1101"\)\?"صندوق":"بانک"/);
});

test("treasury posting debits or credits the selected account code and preserves account identity",()=>{
 assert.match(app,/const cashAccount=accountCode/);
 assert.match(app,/\{accountCode:cashAccount,debitRial:amount,creditRial:0/);
 assert.match(app,/\{accountCode:cashAccount,debitRial:0,creditRial:amount/);
 assert.match(app,/accountCode,accountName:cashAccountRow\.title\|\|accountCode/);
 assert.match(app,/accountName:original\.accountName\|\|""/);
});

test("treasury list and CSV export expose the selected account and account code",()=>{
 assert.match(app,/x\.accountCode,x\.accountName,x\.currency/);
 assert.match(app,/h\(x\.accountName\|\|x\.method\)/);
 assert.match(app,/\["نوع","حساب صندوق \/ بانک","کد حساب","طرف حساب"/);
 assert.match(app,/item\.accountName\|\|item\.method\|\|""/);
 assert.match(app,/item\.accountCode\|\|""/);
});
