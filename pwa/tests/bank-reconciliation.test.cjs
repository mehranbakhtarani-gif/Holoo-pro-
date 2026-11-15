const test=require("node:test");
const assert=require("node:assert/strict");
const {parseBankCsv,getTreasurySignedAmount,findBankMatchCandidates,autoMatchBankLines,validateBankManualMatch}=require("../bank-reconciliation.js");

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
