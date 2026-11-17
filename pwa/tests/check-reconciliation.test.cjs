const test=require("node:test");
const assert=require("node:assert/strict");
const {validateClearedCheckForReversal,validateEndorsedCheckForReversal,validateExactVoucherInverse}=require("../check-reconciliation.js");

test("validates a received cheque against its exact bank, receivable and party-ledger postings",()=>{
 const result=validateClearedCheckForReversal({
  check:{id:4,kind:"RECEIVED",status:"CLEARED",partyId:7,amount:250000},
  treasury:{id:11,checkId:4,partyId:7,kind:"RECEIPT",amount:250000,reference:"CHECK:CLEAR:4"},
  voucherLines:[{accountCode:"1102",debitRial:250000,creditRial:0},{accountCode:"1103",debitRial:0,creditRial:250000}],
  partyLedgerRows:[{partyId:7,debitRial:0,creditRial:250000,referenceId:"CHECK:CLEAR:4"}]
 });
 assert.equal(result.ok,true);
});

test("rejects a balanced received-cheque voucher posted to the wrong bank account",()=>{
 const result=validateClearedCheckForReversal({
  check:{id:4,kind:"RECEIVED",status:"CLEARED",partyId:7,amount:250000},
  treasury:{id:11,checkId:4,partyId:7,kind:"RECEIPT",amount:250000,reference:"CHECK:CLEAR:4"},
  voucherLines:[{accountCode:"1101",debitRial:250000,creditRial:0},{accountCode:"1103",debitRial:0,creditRial:250000}],
  partyLedgerRows:[{partyId:7,debitRial:0,creditRial:250000,referenceId:"CHECK:CLEAR:4"}]
 });
 assert.equal(result.ok,false);
 assert.ok(result.issues.some(issue=>issue.includes("حساب‌های سند اصلی")));
});

test("rejects missing, duplicate or wrong-sign party ledger rows for a cleared cheque",()=>{
 const base={check:{id:5,kind:"PAYABLE",status:"CLEARED",partyId:8,amount:900},treasury:{id:12,checkId:5,partyId:8,kind:"PAYMENT",amount:900,reference:"CHECK:CLEAR:5"},voucherLines:[{accountCode:"2101",debitRial:900,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:900}]};
 for(const rows of [[],[{partyId:8,debitRial:0,creditRial:900,referenceId:"CHECK:CLEAR:5"}],[{partyId:8,debitRial:900,creditRial:0,referenceId:"CHECK:CLEAR:5"},{partyId:8,debitRial:900,creditRial:0,referenceId:"CHECK:CLEAR:5"}]]){
  assert.equal(validateClearedCheckForReversal({...base,partyLedgerRows:rows}).ok,false);
 }
});

test("validates an endorsed cheque across both parties and exact control-account postings",()=>{
 const result=validateEndorsedCheckForReversal({
  check:{id:9,kind:"RECEIVED",status:"ENDORSED",partyId:1,endorseToPartyId:2,amount:5000},
  sourceParty:{id:1,kind:"CUSTOMER"},targetParty:{id:2,kind:"SUPPLIER"},
  voucherLines:[{accountCode:"2101",debitRial:5000,creditRial:0},{accountCode:"1103",debitRial:0,creditRial:5000}],
  partyLedgerRows:[{partyId:1,debitRial:0,creditRial:5000,referenceId:"CHECK:ENDORSE:9"},{partyId:2,debitRial:5000,creditRial:0,referenceId:"CHECK:ENDORSE:9"}]
 });
 assert.equal(result.ok,true);
});

test("rejects endorsement when one party ledger posting or its control account is wrong",()=>{
 const result=validateEndorsedCheckForReversal({
  check:{id:9,kind:"RECEIVED",status:"ENDORSED",partyId:1,endorseToPartyId:2,amount:5000},
  sourceParty:{id:1,kind:"CUSTOMER"},targetParty:{id:2,kind:"SUPPLIER"},
  voucherLines:[{accountCode:"2101",debitRial:5000,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:5000}],
  partyLedgerRows:[{partyId:1,debitRial:0,creditRial:5000,referenceId:"CHECK:ENDORSE:9"}]
 });
 assert.equal(result.ok,false);
});

test("exact voucher inverse is account-by-account, not only total-balanced",()=>{
 const original=[{accountCode:"1102",debitRial:100,creditRial:0},{accountCode:"1103",debitRial:0,creditRial:100}];
 assert.equal(validateExactVoucherInverse(original,[{accountCode:"1102",debitRial:0,creditRial:100},{accountCode:"1103",debitRial:100,creditRial:0}]),true);
 assert.equal(validateExactVoucherInverse(original,[{accountCode:"1101",debitRial:0,creditRial:100},{accountCode:"1103",debitRial:100,creditRial:0}]),false);
});
