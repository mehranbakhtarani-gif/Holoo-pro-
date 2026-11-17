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

test("foreign payable accrual and active payments reconcile to the supplier subledger",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:3,name:"Supplier",kind:"SUPPLIER",balance:-600}],
  foreignPayables:[{id:5,supplierId:3,sourceNumber:"S7",currency:"USD",amountMinor:1000,paidMinor:400,bookedRial:1000,bookedRialPaid:400,status:"PARTIAL",shipmentReceivedAt:1}],
  foreignPayments:[{id:9,payableId:5,supplierId:3,reference:"FXPAY:S7:1",amountMinor:400,bookedRial:400,settlementRial:450,status:"POSTED"}],
  treasury:[{id:10,kind:"PAYMENT",partyId:3,amount:450,foreignAmountMinor:400,foreignPayableId:5,reference:"FXPAY:S7:1"}],
  partyLedger:[{partyId:3,referenceId:"IMPORT-RECEIPT:S7",debitRial:0,creditRial:1000},{partyId:3,referenceId:"FXPAY:S7:1",debitRial:400,creditRial:0}]
 });
 assert.equal(result.matched,1);
 assert.equal(result.rows[0].foreignPayableOutstandingRial,600);
 assert.equal(result.rows[0].foreignPayableLedgerBalanceRial,-600);
});
test("reversed foreign installment restores the payable and supplier ledger",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:3,name:"Supplier",kind:"SUPPLIER",balance:-1000}],
  foreignPayables:[{id:5,supplierId:3,sourceNumber:"S7",currency:"USD",amountMinor:1000,paidMinor:0,bookedRial:1000,bookedRialPaid:0,status:"OPEN",shipmentReceivedAt:1}],
  foreignPayments:[{id:9,payableId:5,supplierId:3,reference:"FXPAY:S7:1",amountMinor:400,bookedRial:400,settlementRial:450,status:"REVERSED"}],
  treasury:[{id:10,kind:"PAYMENT",partyId:3,amount:450,foreignAmountMinor:400,foreignPayableId:5,reference:"FXPAY:S7:1",status:"REVERSED"},{id:11,kind:"RECEIPT",partyId:3,amount:450,foreignAmountMinor:400,foreignPayableId:5,reference:"FXPAY-REV:9",reversalOf:"FXPAY:S7:1"}],
  partyLedger:[{partyId:3,referenceId:"IMPORT-RECEIPT:S7",debitRial:0,creditRial:1000},{partyId:3,referenceId:"FXPAY:S7:1",debitRial:400,creditRial:0},{partyId:3,referenceId:"FXPAY-REV:9",debitRial:0,creditRial:400}]
 });
 assert.equal(result.matched,1);
 assert.equal(result.rows[0].foreignPayableOutstandingRial,1000);
 assert.equal(result.rows[0].foreignPayableLedgerBalanceRial,-1000);
});
test("orphan party-ledger rows and unassigned active payables are surfaced globally",()=>{
 const result=reconcilePartyBalances({parties:[{id:3,name:"Supplier",kind:"SUPPLIER",balance:0}],partyLedger:[{partyId:99,referenceId:"ORPHAN",debitRial:10,creditRial:0}],importChargePayables:[{id:8,partyId:null,amountRial:100,paidRial:50,status:"PARTIAL"}]});
 assert.equal(result.orphanLedgerRows.length,1);
 assert.equal(result.orphanPayableCount,1);
 assert.equal(result.withIssues,1);
 assert.ok(result.orphanIssues.some(x=>x.includes("گردش تفصیلی")));
});

test("ordinary party receipts and payments must each have one matching detail movement",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:1,name:"Customer",kind:"CUSTOMER",balance:-100}],
  treasury:[
   {id:1,partyId:1,kind:"RECEIPT",amount:500,reference:"TREASURY:R1"},
   {id:2,partyId:1,kind:"PAYMENT",amount:400,reference:"TREASURY:P1"}
  ],
  partyLedger:[
   {partyId:1,referenceId:"TREASURY:R1",debitRial:0,creditRial:500},
   {partyId:1,referenceId:"TREASURY:P1",debitRial:400,creditRial:0}
  ]
 });
 assert.equal(result.matched,1);
});
test("ordinary treasury movement with missing or duplicated detail rows is reported",()=>{
 const missing=reconcilePartyBalances({
  parties:[{id:1,name:"Customer",kind:"CUSTOMER",balance:0}],
  treasury:[{id:1,partyId:1,kind:"RECEIPT",amount:500,reference:"TREASURY:R1"}]
 });
 assert.equal(missing.withIssues,1);
 assert.ok(missing.rows[0].issues.some(x=>x.includes("ثبت نشده")));
 const duplicate=reconcilePartyBalances({
  parties:[{id:1,name:"Customer",kind:"CUSTOMER",balance:1000}],
  treasury:[{id:1,partyId:1,kind:"RECEIPT",amount:500,reference:"TREASURY:R1"}],
  partyLedger:[
   {partyId:1,referenceId:"TREASURY:R1",debitRial:0,creditRial:500},
   {partyId:1,referenceId:"TREASURY:R1",debitRial:0,creditRial:500}
  ]
 });
 assert.equal(duplicate.withIssues,1);
 assert.ok(duplicate.rows[0].issues.some(x=>x.includes("تکراری")));
});
test("ordinary treasury detail amount, direction and party must match its source transaction",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:1,name:"Customer",kind:"CUSTOMER",balance:200}],
  treasury:[{id:1,partyId:1,kind:"RECEIPT",amount:500,reference:"TREASURY:R1"}],
  partyLedger:[{partyId:1,referenceId:"TREASURY:R1",debitRial:300,creditRial:0}]
 });
 assert.equal(result.withIssues,1);
 assert.ok(result.rows[0].issues.some(x=>x.includes("مطابقت ندارد")));
});

test("party-linked treasury rows pointing to missing parties are surfaced globally",()=>{
 const result=reconcilePartyBalances({
  parties:[],
  treasury:[{id:7,partyId:77,kind:"PAYMENT",amount:250,reference:"TREASURY:ORPHAN"}]
 });
 assert.equal(result.orphanTreasuryRows.length,1);
 assert.equal(result.withIssues,1);
 assert.ok(result.orphanIssues.some(x=>x.includes("خزانه")));
});

test("invoice allocations reconcile invoice, treasury, direction, counterparty and subledger",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:1,name:"Customer",kind:"CUSTOMER",balance:700}],
  invoices:[{id:10,number:"S-10",partyId:1,kind:"SALE",status:"POSTED",total:1000}],
  treasury:[{id:20,partyId:1,kind:"RECEIPT",amount:300,reference:"T-20",status:"POSTED"}],
  treasuryAllocations:[{id:30,partyId:1,invoiceNumber:"S-10",treasuryId:20,amount:300,status:"POSTED"}],
  partyLedger:[{partyId:1,referenceId:"S-10",debitRial:1000,creditRial:0},{partyId:1,referenceId:"T-20",debitRial:0,creditRial:300}]
 });
 assert.equal(result.matched,1);
});
test("invoice allocation rejects wrong treasury party or direction and over-allocation",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:1,name:"Customer",kind:"CUSTOMER",balance:700}],
  invoices:[{id:10,number:"S-10",partyId:1,kind:"SALE",status:"POSTED",total:1000}],
  treasury:[{id:20,partyId:2,kind:"PAYMENT",amount:200,reference:"T-20",status:"POSTED"}],
  treasuryAllocations:[{id:30,partyId:1,invoiceNumber:"S-10",treasuryId:20,amount:1200,status:"POSTED"}],
  partyLedger:[{partyId:1,referenceId:"S-10",debitRial:1000,creditRial:0}]
 });
 assert.equal(result.withIssues,1);
 assert.ok(result.rows[0].issues.some(x=>x.includes("بیشتر است")));
 assert.ok(result.rows[0].issues.some(x=>x.includes("طرف حساب")));
 assert.ok(result.rows[0].issues.some(x=>x.includes("نوع دریافت/پرداخت")));
});
test("reversed allocations are excluded from settlement totals but retain original treasury reference",()=>{
 const result=reconcilePartyBalances({
  parties:[{id:1,name:"Customer",kind:"CUSTOMER",balance:1000}],
  invoices:[{id:10,number:"S-10",partyId:1,kind:"SALE",status:"POSTED",total:1000}],
  treasury:[{id:20,partyId:1,kind:"RECEIPT",amount:300,reference:"T-20",status:"POSTED"}],
  treasuryAllocations:[{id:30,partyId:1,invoiceNumber:"S-10",treasuryId:null,originalTreasuryId:20,amount:300,status:"REVERSED"}],
  partyLedger:[{partyId:1,referenceId:"S-10",debitRial:1000,creditRial:0}]
 });
 assert.equal(result.matched,1);
});
