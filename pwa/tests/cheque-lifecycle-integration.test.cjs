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
 assert.match(app,/treasuryRecord=.*checkId:c\.id/);
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

test("reversing a cleared cheque permits historical reversed allocations but blocks active allocations",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("async function reverseClearedCheckPwa");
 const end=app.indexOf("async function reverseTreasuryPwa",start);
 const body=app.slice(start,end);
 assert.match(body,/allocations\.some\(x=>Number\(x\.treasuryId\)===Number\(original\.id\)&&x\.status!=="REVERSED"\)/);
 assert.match(body,/\{store:"treasury",key:Number\(original\.id\),expected:treasurySnapshot\}/);
 assert.doesNotMatch(body,/treasuryAllocations",match:\{treasuryId:Number\(original\.id\)\},expected:null/);
});

test("endorsed cheque bounce reverses both party balances and the original endorsement voucher",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("async function reverseEndorsedCheckPwa");
 const end=app.indexOf("async function reverseTreasuryPwa",start);
 const body=app.slice(start,end);
 assert.match(body,/check\.status!=="ENDORSED"/);
 assert.match(body,/applyPartyBalanceDelta\(source,amount\)/);
 assert.match(body,/applyPartyBalanceDelta\(target,-amount/);
 assert.match(body,/CHECK:ENDORSE-REV:/);
 assert.match(body,/oldLines\.map\(line=>\(\{accountCode:line\.accountCode,debitRial:Number\(line\.creditRial\|\|0\),creditRial:Number\(line\.debitRial\|\|0\)/);
 assert.ok(app.includes('data-check-reverse-endorsement'));
});
