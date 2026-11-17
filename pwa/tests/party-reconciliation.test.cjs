"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {reconcilePartyBalances}=require("../party-reconciliation.js");
test("party balance must equal the net of opening and subsequent ledger movements",()=>{
 const result=reconcilePartyBalances({parties:[{id:1,name:"Customer",kind:"CUSTOMER",balance:300}],partyLedger:[{partyId:1,referenceId:"OPENING:PARTY:1",debitRial:500,creditRial:0},{partyId:1,referenceId:"INV-1",debitRial:0,creditRial:200}]});
 assert.equal(result.matched,1);assert.equal(result.rows[0].difference,0);
});
test("party balance mismatch is reported instead of silently accepted",()=>{
 const result=reconcilePartyBalances({parties:[{id:1,name:"Supplier",kind:"SUPPLIER",balance:-700}],partyLedger:[{partyId:1,referenceId:"OPENING:PARTY:1",debitRial:0,creditRial:600}]});
 assert.equal(result.withIssues,1);assert.equal(result.rows[0].difference,-100);assert.ok(result.rows[0].issues.some(x=>x.includes("برابر نیست")));
});
test("assigned ancillary payable reconciles its accrual and partial treasury payment",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:3,name:"Supplier",kind:"SUPPLIER",balance:-700}],
  importChargePayables:[{id:5,partyId:3,amountRial:1000,paidRial:300,status:"PARTIAL"}],
  treasury:[{id:9,kind:"PAYMENT",partyId:3,amount:300,reference:"TREASURY:IMPORT-CHARGE:5:9",importChargePayableId:5,status:"POSTED"}],
  partyLedger:[{partyId:3,referenceId:"IMPORT-CHARGE-ACCRUAL:5",debitRial:0,creditRial:1000},{partyId:3,referenceId:"TREASURY:IMPORT-CHARGE:5:9",debitRial:300,creditRial:0}]
 });
 assert.equal(result.matched,1);assert.equal(result.rows[0].ancillaryOutstandingRial,700);assert.equal(result.rows[0].ancillaryLedgerBalanceRial,-700);
});
test("reversed ancillary installment restores the payable balance and detail ledger",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:3,name:"Supplier",kind:"SUPPLIER",balance:-1000}],
  importChargePayables:[{id:5,partyId:3,amountRial:1000,paidRial:0,status:"OPEN"}],
  treasury:[{id:9,kind:"PAYMENT",partyId:3,amount:300,reference:"TREASURY:IMPORT-CHARGE:5:9",importChargePayableId:5,status:"REVERSED"},{id:10,kind:"RECEIPT",partyId:3,amount:300,reference:"TREASURY-REV:9",reversalOfId:9}],
  partyLedger:[{partyId:3,referenceId:"IMPORT-CHARGE-ACCRUAL:5",debitRial:0,creditRial:1000},{partyId:3,referenceId:"TREASURY:IMPORT-CHARGE:5:9",debitRial:300,creditRial:0},{partyId:3,referenceId:"TREASURY-REV:9",debitRial:0,creditRial:300}]
 });
 assert.equal(result.matched,1);assert.equal(result.rows[0].ancillaryOutstandingRial,1000);assert.equal(result.rows[0].ancillaryLedgerBalanceRial,-1000);
});
test("legacy charges awaiting reconciliation are excluded from confirmed party payables",()=>{
 const result=reconcilePartyBalances({parties:[{id:3,name:"Supplier",kind:"SUPPLIER",balance:0}],importChargePayables:[{id:5,partyId:null,amountRial:1000,paidRial:0,status:"RECONCILIATION_REQUIRED"}]});
 assert.equal(result.matched,1);assert.equal(result.rows[0].ancillaryPayableCount,0);
});
test("duplicate or mismatched payable accruals are reported",()=>{
 const result=reconcilePartyBalances({parties:[{id:3,name:"Supplier",kind:"SUPPLIER",balance:-1000}],importChargePayables:[{id:5,partyId:3,amountRial:1000,paidRial:0,status:"OPEN"}],partyLedger:[{partyId:3,referenceId:"IMPORT-CHARGE-ACCRUAL:5",debitRial:0,creditRial:1000},{partyId:3,referenceId:"IMPORT-CHARGE-ACCRUAL:5",debitRial:0,creditRial:1000}]});
 assert.equal(result.withIssues,1);assert.ok(result.rows[0].issues.some(x=>x.includes("سند ایجاد بدهی")));
});
test("PWA wires party reconciliation into the party page and offline cache",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8"),html=fs.readFileSync(path.resolve(__dirname,"../index.html"),"utf8"),sw=fs.readFileSync(path.resolve(__dirname,"../sw.js"),"utf8");
 assert.match(app,/HolooPartyReconciliation\.reconcilePartyBalances/);
 assert.match(html,/party-reconciliation\.js/);
 assert.match(sw,/party-reconciliation\.js/);
});
