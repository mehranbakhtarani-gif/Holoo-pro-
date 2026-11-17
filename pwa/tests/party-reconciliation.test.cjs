const test=require("node:test");
const assert=require("node:assert/strict");
const {reconcilePartyBalances}=require("../party-reconciliation.js");

test("reconciles customer and supplier balances against subledger and control accounts",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:1,name:"Customer",balance:700},{id:2,name:"Supplier",balance:-300}],
  partyLedger:[{partyId:1,debitRial:1000,creditRial:300,referenceId:"SALE-1"},{partyId:2,debitRial:0,creditRial:500,referenceId:"PUR-1"},{partyId:2,debitRial:200,creditRial:0,referenceId:"PAY-1"}],
  accounts:[{id:"1103",openingDebitRial:0,openingCreditRial:0},{id:"2101",openingDebitRial:0,openingCreditRial:0}],
  vouchers:[{id:11,reference:"SALE-1"},{id:12,reference:"RECEIPT-1"},{id:13,reference:"PUR-1"},{id:14,reference:"PAY-1"}],
  voucherLines:[
   {voucherId:11,accountCode:"1103",debitRial:1000,creditRial:0},
   {voucherId:12,accountCode:"1103",debitRial:0,creditRial:300},
   {voucherId:13,accountCode:"2101",debitRial:0,creditRial:500},
   {voucherId:14,accountCode:"2101",debitRial:200,creditRial:0}
  ]
 });
 assert.equal(result.ok,true);
 assert.equal(result.totals.partyBalanceRial,400);
 assert.equal(result.totals.partyLedgerBalanceRial,400);
 assert.equal(result.totals.controlAccountBalanceRial,400);
 assert.equal(result.totals.controlVsLedgerDeltaRial,0);
});

test("opening balances in control accounts reconcile even when their counterpart is opening equity",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:1,name:"Customer",balance:125000},{id:2,name:"Supplier",balance:-75000}],
  partyLedger:[{partyId:1,debitRial:125000,creditRial:0,referenceId:"OPENING:PARTY:1"},{partyId:2,debitRial:0,creditRial:75000,referenceId:"OPENING:PARTY:2"}],
  accounts:[{id:"1103",openingDebitRial:125000,openingCreditRial:0},{id:"2101",openingDebitRial:0,openingCreditRial:75000}],
  vouchers:[],
  voucherLines:[]
 });
 assert.equal(result.ok,true);
 assert.equal(result.totals.partyVsLedgerDeltaRial,0);
 assert.equal(result.totals.controlVsLedgerDeltaRial,0);
});

test("detects a stale stored party balance and a missing control-account posting",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:7,name:"Customer",balance:900}],
  partyLedger:[{partyId:7,debitRial:1000,creditRial:0,referenceId:"SALE-7"}],
  accounts:[{id:"1103",openingDebitRial:0,openingCreditRial:0},{id:"2101",openingDebitRial:0,openingCreditRial:0}],
  vouchers:[{id:70,reference:"SALE-7"}],
  voucherLines:[{voucherId:70,accountCode:"4101",debitRial:0,creditRial:1000}]
 });
 assert.equal(result.rows[0].ok,false);
 assert.equal(result.rows[0].deltaRial,-100);
 assert.equal(result.totals.controlVsLedgerDeltaRial,-1000);
 assert.equal(result.ok,false);
});

test("aggregates shared voucher references across multiple parties without double counting",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:1,name:"Customer",balance:0},{id:2,name:"Supplier",balance:0}],
  partyLedger:[{partyId:1,debitRial:0,creditRial:500,referenceId:"CHECK:ENDORSE:1"},{partyId:2,debitRial:500,creditRial:0,referenceId:"CHECK:ENDORSE:1"}],
  accounts:[{id:"1103",openingDebitRial:0,openingCreditRial:0},{id:"2101",openingDebitRial:0,openingCreditRial:0}],
  vouchers:[{id:9,reference:"CHECK:ENDORSE:1"}],
  voucherLines:[{voucherId:9,accountCode:"2101",debitRial:500,creditRial:0},{voucherId:9,accountCode:"1103",debitRial:0,creditRial:500}]
 });
 assert.equal(result.totals.partyLedgerBalanceRial,0);
 assert.equal(result.totals.controlAccountBalanceRial,0);
 assert.equal(result.ok,true);
});

test("reports orphan and invalid party-ledger movements",()=>{
 const result=reconcilePartyBalances({
  parties:[],
  partyLedger:[{partyId:99,debitRial:10,creditRial:0,referenceId:"ORPHAN"},{partyId:1,debitRial:1.5,creditRial:0,referenceId:"BAD"}],
  accounts:[],vouchers:[],voucherLines:[]
 });
 assert.equal(result.orphanLedgerRows,1);
 assert.equal(result.invalidLedgerRows,1);
 assert.equal(result.withIssues,2);
 assert.equal(result.ok,false);
});
