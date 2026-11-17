const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("party statement print action opens a printable statement for the selected party",()=>{
 assert.match(app,/data-party-statement=/);
 assert.match(app,/querySelectorAll\("\[data-party-statement\]"\)/);
 assert.match(app,/صورتحساب طرف حساب/);
 assert.match(app,/popup\.print\(\)/);
});

test("party statement CSV exports opening balance and dated running ledger balances",()=>{
 assert.match(app,/data-party-statement-csv=/);
 assert.match(app,/a\.download="party-statement-"\+party\.id\+"\.csv"/);
 assert.match(app,/مانده افتتاحیه/);
 assert.match(app,/partyStatementData\(party,partyLedger\)/);
 assert.match(app,/for\(const row of statement\.rows\)/);
 assert.match(app,/\["نام طرف حساب",party\.name/);assert.match(app,/\["تلفن",party\.phone\|\|"—"/);assert.match(app,/ماهیت/);
});


test("party search includes identifier, contact details, type and balance",()=>{
 assert.match(app,/جست‌وجوی کد، نام، تلفن، نشانی، نوع یا مانده طرف حساب/);
 assert.match(app,/parties\.filter\(x=>\[x\.id,x\.name,x\.kind==="CUSTOMER"\?"مشتری":x\.kind==="SUPPLIER"\?"تأمین‌کننده":"هر دو",x\.group,x\.region,x\.phone,x\.email,x\.nationalId,x\.economicCode,x\.postalCode,x\.address,x\.balance,fmt\(x\.balance\|\|0\),x\.status==="BLOCKED"\?"مسدود":"فعال",x\.blockedReason\]/);
});

test("party statements show the recorded opening balance once and exclude its ledger row from later movements",()=>{
 assert.match(app,/function partyStatementData\(party,ledger\)/);
 assert.match(app,/String\(r\.referenceId\|\|""\)==="OPENING:PARTY:"\+party\.id/);
 assert.match(app,/const opening=openingRows\.length\?openingRows\.reduce/);
 assert.match(app,/const statement=partyStatementData\(party,partyLedger\)/);
 assert.match(app,/for\(const row of statement\.rows\)/);
});
test("party statement rejects malformed debit or credit ledger movements",()=>{
 assert.match(app,/گردش صورتحساب طرف حساب نامعتبر است/);
 assert.match(app,/Number\.isSafeInteger\(Number\(r\.debitRial\|\|0\)\)/);
 assert.match(app,/Number\.isSafeInteger\(Number\(r\.creditRial\|\|0\)\)/);
});


test("invoice and opening control-account journal lines retain their party identity",()=>{
 assert.match(app,/accountCode:"1103",partyId:p\.id,debitRial:total/);
 assert.match(app,/accountCode:"2101",partyId:p\.id,debitRial:0,creditRial:total/);
 assert.match(app,/accountCode:"2101",partyId:commissionParty\.id,debitRial:0,creditRial:commissionAmount/);
 assert.match(app,/for\(const line of plan\.journal\)tx\.objectStore\("voucherLines"\)\.add\(\{\.\.\.line,partyId,voucherId:addVoucher\.result\}\)/);
});


test("all additional payable and FX control-account journal lines carry the responsible party",()=>{
 assert.match(app,/accountCode:"2101",partyId:party\.id,debitRial:0,creditRial:costs\.goodsRial/);
 assert.match(app,/accountCode:"2101",partyId:target\.id,debitRial:amount,creditRial:0/);
 assert.match(app,/accountCode:"1103",partyId:party\.id,debitRial:0,creditRial:amount/);
 assert.match(app,/accountCode:"2101",partyId:party\.id,debitRial:fx\.gainRial,creditRial:0/);
 assert.match(app,/accountCode:"1103",partyId:party\.id,debitRial:0,creditRial:fx\.lossRial/);
 assert.match(app,/accountCode:"2101",partyId:party\.id,debitRial:plan\.bookedRial,creditRial:0/);
 assert.match(app,/accountCode:"2101",partyId:party\.id,debitRial:0,creditRial:cost,description:"بدهی خرید دارایی/);
});


test("foreign payable reversal control-account line retains supplier identity",()=>{
 assert.match(app,/accountCode:"2101",partyId:party\.id,debitRial:0,creditRial:plan\.bookedRial,description:"برگشت بدهی ارزی "/);
});
