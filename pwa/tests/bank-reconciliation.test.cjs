const test=require("node:test");
const assert=require("node:assert/strict");
const {parseBankCsv,getTreasurySignedAmount,normalizeBankIdentity,findBankMatchCandidates,autoMatchBankLines,validateBankManualMatch}=require("../bank-reconciliation.js");

test("parses quoted CSV fields, Persian digits and signed amounts",()=>{
 const rows=parseBankCsv('تاریخ,مبلغ,شرح,شماره مرجع\n2026-11-01,۱۲۳۴۵,"واریز, مشتری",A-1\n2026-11-02,-۵۰۰۰,برداشت,B-2',"بانک نمونه");
 assert.equal(rows.length,2);
 assert.equal(rows[0].signedAmount,12345);
 assert.equal(rows[0].description,"واریز, مشتری");
 assert.equal(rows[1].signedAmount,-5000);
 assert.equal(rows[0].bank,"بانک نمونه");
});

test("rejects missing columns, malformed quotes and invalid amounts",()=>{
 assert.throws(()=>parseBankCsv("تاریخ,شرح\n2026-01-01,واریز"));
 assert.throws(()=>parseBankCsv('date,amount,description\n2026-01-01,100,"unfinished'));
 assert.throws(()=>parseBankCsv("date,amount\n2026-01-01,abc"));
});

test("finds bank movements by exact signed amount and date tolerance",()=>{
 const treasury=[{id:1,method:"بانک",kind:"RECEIPT",amount:1000,date:1000},{id:2,method:"بانک",kind:"PAYMENT",amount:500,date:1000},{id:3,method:"صندوق",kind:"RECEIPT",amount:1000,date:1000}];
 assert.equal(getTreasurySignedAmount(treasury[0]),1000);
 assert.equal(getTreasurySignedAmount(treasury[1]),-500);
 assert.equal(findBankMatchCandidates({signedAmount:1000,date:1000},treasury).length,1);
 assert.equal(findBankMatchCandidates({signedAmount:1000,date:1000},treasury,[1]).length,0);
});

test("auto matches unique movements and suggests ambiguous matches",()=>{
 const treasury=[{id:1,method:"بانک",kind:"RECEIPT",amount:1000,date:1000},{id:2,method:"بانک",kind:"RECEIPT",amount:1000,date:2000}];
 const result=autoMatchBankLines([{id:1,status:"UNMATCHED",signedAmount:1000,date:1000}],treasury,3);
 assert.equal(result[0].status,"SUGGESTED");
 assert.deepEqual(result[0].candidateTreasuryIds,[1,2]);
});

test("manual match validates direction, amount and duplicate use",()=>{
 const line={status:"UNMATCHED",signedAmount:-500,date:1000};
 const row={id:3,method:"بانک",kind:"PAYMENT",amount:500,date:1000};
 assert.equal(validateBankManualMatch(line,row,[]),true);
 assert.throws(()=>validateBankManualMatch(line,{...row,kind:"RECEIPT"},[]));
 assert.throws(()=>validateBankManualMatch(line,row,[3]));
});

test("parses bank-specific debit and credit columns into signed movements",()=>{
 const rows=parseBankCsv("تاریخ,برداشت,واریز,شرح\n2026-11-03,۲۵۰۰۰,0,خرید کالا\n2026-11-04,0,۷۵۰۰۰,واریز مشتری");
 assert.equal(rows[0].signedAmount,-25000);
 assert.equal(rows[1].signedAmount,75000);
});
test("rejects rows with both debit and credit or no movement",()=>{
 assert.throws(()=>parseBankCsv("date,debit,credit\n2026-11-03,100,200"));
 assert.throws(()=>parseBankCsv("date,debit,credit\n2026-11-03,0,0"));
});
test("supports English debit and deposit column headers",()=>{
 const rows=parseBankCsv("date,withdrawal,deposit\n2026-11-03,125,0\n2026-11-04,0,900");
 assert.deepEqual(rows.map(x=>x.signedAmount),[-125,900]);
});

test("PWA performs manual and automatic bank matching inside shared readwrite transactions",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/db\.transaction\(\["bankStatementLines","treasury","auditLog"\],"readwrite"\)/);
 assert.match(app,/const linesRequest=tx\.objectStore\("bankStatementLines"\)\.getAll\(\)/);
 assert.match(app,/const matchedIds=lines\.filter\(x=>x\.status==="MATCHED"/);
});

 
test("automatic and manual bank matching reject reversed treasury movements",()=>{
 const line={id:1,date:1000,signedAmount:500,status:"UNMATCHED"};
 const reversed={id:2,method:"بانک",kind:"RECEIPT",amount:500,date:1000,status:"REVERSED"};
 assert.deepEqual(findBankMatchCandidates(line,[reversed]),[]);
 assert.throws(()=>validateBankManualMatch(line,reversed,[]),/حساب بانکی فعال/);
});


test("bank statement candidates are restricted to the selected bank account",()=>{
 const line={id:1,date:1000,signedAmount:1000,bank:"بانک ملت",status:"UNMATCHED"};
 const treasury=[
  {id:1,method:"بانک",accountCode:"1102101",accountName:"بانک ملت • جاری",kind:"RECEIPT",amount:1000,date:1000},
  {id:2,method:"بانک",accountCode:"1102102",accountName:"بانک ملی • جاری",kind:"RECEIPT",amount:1000,date:1000}
 ];
 assert.deepEqual(findBankMatchCandidates(line,treasury).map(row=>row.id),[1]);
});

test("bank identity normalization handles Persian and Arabic letter variants",()=>{
 assert.equal(normalizeBankIdentity("بانك ملت"),normalizeBankIdentity("بانک ملت"));
 assert.equal(normalizeBankIdentity("بانک ي"),normalizeBankIdentity("بانک ی"));
});

test("manual matching rejects a movement from another bank or a non-bank account code",()=>{
 const line={status:"UNMATCHED",signedAmount:1000,bank:"بانک ملت"};
 const otherBank={id:2,method:"بانک",accountCode:"1102102",accountName:"بانک ملی",kind:"RECEIPT",amount:1000,date:1000};
 const cashCode={id:3,method:"بانک",accountCode:"1101101",accountName:"بانک ملت",kind:"RECEIPT",amount:1000,date:1000};
 assert.throws(()=>validateBankManualMatch(line,otherBank,[]),/بانک یا حساب/);
 assert.throws(()=>validateBankManualMatch(line,cashCode,[]),/بانک یا حساب/);
});

test("bank statement with an identified bank cannot match a legacy treasury row without account identity",()=>{
 const line={status:"UNMATCHED",signedAmount:1000,bank:"بانک ملت"};
 const legacy={id:4,method:"بانک",kind:"RECEIPT",amount:1000,date:1000};
 assert.deepEqual(findBankMatchCandidates(line,[legacy]),[]);
 assert.throws(()=>validateBankManualMatch(line,legacy,[]),/بانک یا حساب/);
});


test("manual bank matching rejects dates outside the permitted window",()=>{
 const line={status:"UNMATCHED",signedAmount:1000,date:1000,bank:"بانک ملت"};
 const sameBank={id:8,method:"بانک",accountCode:"1102101",accountName:"بانک ملت • جاری",kind:"RECEIPT",amount:1000,date:1000+31*86400000};
 assert.throws(()=>validateBankManualMatch(line,sameBank,[]),/تاریخ گردش بانکی/);
 assert.equal(validateBankManualMatch(line,{...sameBank,date:1000+30*86400000},[]),true);
});


test("rejects impossible calendar dates in bank CSV",()=>{
 assert.throws(()=>parseBankCsv("date,amount\n2026-02-31,100"),/تاریخ نامعتبر/);
 assert.throws(()=>parseBankCsv("date,amount\n2026/04/31,100"),/تاریخ نامعتبر/);
 assert.equal(parseBankCsv("date,amount\n2026-02-28,100")[0].signedAmount,100);
});
