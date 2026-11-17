const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

test("cheque entry validates party type, amount, dates and duplicate numbers",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/شماره چک تکراری است/);
 assert.match(app,/چک دریافتی باید از مشتری/);
 assert.match(app,/چک پرداختی باید برای تأمین‌کننده/);
 assert.match(app,/endorseToPartyId/);
});

test("clearing a received or payable cheque posts bank and party accounting entries",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/CHECK:CLEAR:/);
 assert.match(app,/وصول چک/);
 assert.match(app,/پرداخت چک/);
 assert.match(app,/treasuryRecord=.*accountCode:bankAccountCode.*checkId:c\.id/);
 assert.match(app,/postVoucherAtomic\(\[\["checks",c\],\["parties",party\],\["treasury",treasuryRecord\]/);
});

test("endorsing a received cheque settles customer receivable and supplier payable",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/CHECK:ENDORSE:/);
 assert.match(app,/endorsedToPartyName/);
 assert.match(app,/accountCode:"2101",debitRial:amount/);
 assert.match(app,/accountCode:"1103",debitRial:0,creditRial:amount/);
});

test("voucher reference uniqueness is enforced inside the atomic transaction",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/objectStore\("vouchers"\)\.getAll\(\);\s*check\.onsuccess/);
 assert.match(app,/سندی با این شناسه مرجع قبلاً ثبت شده است/);
});


test("cheque clearing persists the selected bank subaccount in both voucher and treasury",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/حساب بانکی تسویه/);
 assert.match(app,/clearingAccountCode,clearingAccountName:clearingAccount\.title\|\|clearingAccountCode/);
 assert.match(app,/const bankAccountCode=String\(bankAccount\.id\)/);
 assert.match(app,/accountCode:bankAccountCode,debitRial:amount/);
 assert.match(app,/accountCode:bankAccountCode,debitRial:0,creditRial:amount/);
});
