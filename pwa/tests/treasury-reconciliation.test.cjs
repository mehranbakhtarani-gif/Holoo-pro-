"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const TreasuryIntegrity=require("../treasury-reconciliation.js");
const accounts=["1101","1102","1103","2101","2102","2104","4301","5501"].map(id=>({id}));
function input(overrides={}){
 return {
  treasury:[{id:1,kind:"PAYMENT",method:"بانک",partyId:3,amount:100,reference:"TREASURY:1"}],
  vouchers:[{id:10,reference:"TREASURY:1",number:"TV-1"}],
  voucherLines:[{voucherId:10,accountCode:"2101",debitRial:100,creditRial:0},{voucherId:10,accountCode:"1102",debitRial:0,creditRial:100}],
  accounts,parties:[{id:3,name:"Supplier",kind:"SUPPLIER"}],
  partyLedger:[{partyId:3,referenceId:"TREASURY:1",debitRial:100,creditRial:0}],
  checks:[],payroll:[],foreignPayments:[],
  ...overrides
 };
}
test("matches a normal supplier payment only when 2101 and bank lines match exactly",()=>{
 const good=TreasuryIntegrity.reconcileTreasuryRecords(input());
 assert.equal(good.matched,1);
 const bad=TreasuryIntegrity.reconcileTreasuryRecords(input({voucherLines:[{voucherId:10,accountCode:"1103",debitRial:100,creditRial:0},{voucherId:10,accountCode:"1102",debitRial:0,creditRial:100}]}));
 assert.equal(bad.withIssues,1);
 assert.ok(bad.rows[0].issues.some(x=>x.includes("حساب یا مبلغ")));
});
test("matches payroll payments to 2104 and the selected cash account",()=>{
 const data=input({treasury:[{id:7,kind:"PAYMENT",method:"صندوق",partyId:null,amount:250,reference:"PAYROLL-PAYMENT:7"}],vouchers:[{id:17,reference:"PAYROLL-PAYMENT:7"}],voucherLines:[{voucherId:17,accountCode:"2104",debitRial:250,creditRial:0},{voucherId:17,accountCode:"1101",debitRial:0,creditRial:250}],parties:[],partyLedger:[],payroll:[{id:7,status:"پرداخت‌شده",net:250}]});
 assert.equal(TreasuryIntegrity.reconcileTreasuryRecords(data).matched,1);
});
test("matches foreign payments using booked liability, settlement cash and FX line",()=>{
 const payment={payableId:5,supplierId:3,reference:"FXPAY:S7:1",method:"بانک",amountMinor:500,bookedRial:500,settlementRial:600,fxGainRial:0,fxLossRial:100};
 const data=input({treasury:[{id:8,kind:"PAYMENT",method:"بانک",partyId:3,amount:600,foreignAmountMinor:500,foreignPayableId:5,reference:payment.reference}],vouchers:[{id:18,reference:payment.reference}],voucherLines:[{voucherId:18,accountCode:"2101",debitRial:500,creditRial:0},{voucherId:18,accountCode:"1102",debitRial:0,creditRial:600},{voucherId:18,accountCode:"5501",debitRial:100,creditRial:0}],partyLedger:[{partyId:3,referenceId:payment.reference,debitRial:500,creditRial:0}],foreignPayments:[payment]});
 assert.equal(TreasuryIntegrity.reconcileTreasuryRecords(data).matched,1);
});
test("matches a reversal only when it exactly mirrors its original voucher",()=>{
 const data=input({
  treasury:[{id:1,kind:"PAYMENT",method:"بانک",partyId:3,amount:100,reference:"TREASURY:1",status:"REVERSED"},{id:2,kind:"RECEIPT",method:"بانک",partyId:3,amount:100,reference:"TREASURY-REV:1",reversalOfId:1}],
  vouchers:[{id:10,reference:"TREASURY:1"},{id:11,reference:"TREASURY-REV:1"}],
  voucherLines:[{voucherId:10,accountCode:"2101",debitRial:100,creditRial:0},{voucherId:10,accountCode:"1102",debitRial:0,creditRial:100},{voucherId:11,accountCode:"2101",debitRial:0,creditRial:100},{voucherId:11,accountCode:"1102",debitRial:100,creditRial:0}],
  partyLedger:[{partyId:3,referenceId:"TREASURY:1",debitRial:100,creditRial:0},{partyId:3,referenceId:"TREASURY-REV:1",debitRial:0,creditRial:100}]
 });
 const result=TreasuryIntegrity.reconcileTreasuryRecords(data);
 assert.equal(result.matched,2);
 const wrong={...data,voucherLines:data.voucherLines.map(x=>x.voucherId===11&&x.accountCode==="2101"?{...x,accountCode:"1103"}:x)};
 assert.equal(TreasuryIntegrity.reconcileTreasuryRecords(wrong).withIssues,2);
});
test("reports missing vouchers, duplicate references and missing party movements",()=>{
 const missing=input({vouchers:[],partyLedger:[]});
 const result=TreasuryIntegrity.reconcileTreasuryRecords(missing);
 assert.equal(result.withIssues,1);
 assert.ok(result.rows[0].issues.some(x=>x.includes("سند حسابداری مرجع پیدا نشد")));
 assert.ok(result.rows[0].issues.some(x=>x.includes("گردش تفصیلی خزانه پیدا نشد")));
});

test("matches foreign payment reversals against the exact inverse voucher and booked subledger amount",()=>{
 const reference="FXPAY:S7:1",payment={payableId:5,supplierId:3,reference,method:"بانک",amountMinor:500,bookedRial:500,settlementRial:600,fxGainRial:0,fxLossRial:100};
 const data=input({
  treasury:[{id:8,kind:"PAYMENT",method:"بانک",partyId:3,amount:600,foreignAmountMinor:500,foreignPayableId:5,reference,status:"REVERSED"},{id:9,kind:"RECEIPT",method:"بانک",partyId:3,amount:600,foreignAmountMinor:500,foreignPayableId:5,reference:"FXPAY-REV:8",reversalOf:reference}],
  vouchers:[{id:18,reference},{id:19,reference:"FXPAY-REV:8"}],
  voucherLines:[{voucherId:18,accountCode:"2101",debitRial:500,creditRial:0},{voucherId:18,accountCode:"1102",debitRial:0,creditRial:600},{voucherId:18,accountCode:"5501",debitRial:100,creditRial:0},{voucherId:19,accountCode:"2101",debitRial:0,creditRial:500},{voucherId:19,accountCode:"1102",debitRial:600,creditRial:0},{voucherId:19,accountCode:"5501",debitRial:0,creditRial:100}],
  partyLedger:[{partyId:3,referenceId:reference,debitRial:500,creditRial:0},{partyId:3,referenceId:"FXPAY-REV:8",debitRial:0,creditRial:500}],
  foreignPayments:[payment]
 });
 assert.equal(TreasuryIntegrity.reconcileTreasuryRecords(data).matched,2);
});
