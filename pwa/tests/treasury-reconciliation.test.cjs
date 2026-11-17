"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const TreasuryIntegrity=require("../treasury-reconciliation.js");
const accountTypes={1101:"ASSET",1102:"ASSET",1103:"ASSET",2101:"LIABILITY",2102:"LIABILITY",2104:"LIABILITY",4301:"REVENUE",5501:"EXPENSE"};
const accounts=Object.entries(accountTypes).map(([id,type])=>({id,type}));
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
 const payment={payableId:5,supplierId:3,reference:"FXPAY:S7:1",method:"بانک",currency:"USD",amountMinor:500,fxRateRialPerUnit:120,bookedRial:500,settlementRial:600,fxGainRial:0,fxLossRial:100};
 const data=input({treasury:[{id:8,kind:"PAYMENT",method:"بانک",partyId:3,amount:600,foreignAmountMinor:500,foreignPayableId:5,currency:"USD",fxRateRialPerUnit:120,reference:payment.reference}],vouchers:[{id:18,reference:payment.reference}],voucherLines:[{voucherId:18,accountCode:"2101",debitRial:500,creditRial:0},{voucherId:18,accountCode:"1102",debitRial:0,creditRial:600},{voucherId:18,accountCode:"5501",debitRial:100,creditRial:0}],partyLedger:[{partyId:3,referenceId:payment.reference,debitRial:500,creditRial:0}],foreignPayments:[payment]});
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
 const wrongResult=TreasuryIntegrity.reconcileTreasuryRecords(wrong);assert.equal(wrongResult.withIssues,1);assert.equal(wrongResult.rows.find(row=>row.id===1).ok,true);assert.equal(wrongResult.rows.find(row=>row.id===2).ok,false);
});
test("reports missing vouchers, duplicate references and missing party movements",()=>{
 const missing=input({vouchers:[],partyLedger:[]});
 const result=TreasuryIntegrity.reconcileTreasuryRecords(missing);
 assert.equal(result.withIssues,1);
 assert.ok(result.rows[0].issues.some(x=>x.includes("سند حسابداری مرجع پیدا نشد")));
 assert.ok(result.rows[0].issues.some(x=>x.includes("گردش تفصیلی خزانه پیدا نشد")));
});

test("matches foreign payment reversals against the exact inverse voucher and booked subledger amount",()=>{
 const reference="FXPAY:S7:1",payment={payableId:5,supplierId:3,reference,method:"بانک",currency:"USD",amountMinor:500,fxRateRialPerUnit:120,bookedRial:500,settlementRial:600,fxGainRial:0,fxLossRial:100};
 const data=input({
  treasury:[{id:8,kind:"PAYMENT",method:"بانک",partyId:3,amount:600,foreignAmountMinor:500,foreignPayableId:5,currency:"USD",fxRateRialPerUnit:120,reference,status:"REVERSED"},{id:9,kind:"RECEIPT",method:"بانک",partyId:3,amount:600,foreignAmountMinor:500,foreignPayableId:5,currency:"USD",fxRateRialPerUnit:120,reference:"FXPAY-REV:8",reversalOf:reference}],
  vouchers:[{id:18,reference},{id:19,reference:"FXPAY-REV:8"}],
  voucherLines:[{voucherId:18,accountCode:"2101",debitRial:500,creditRial:0},{voucherId:18,accountCode:"1102",debitRial:0,creditRial:600},{voucherId:18,accountCode:"5501",debitRial:100,creditRial:0},{voucherId:19,accountCode:"2101",debitRial:0,creditRial:500},{voucherId:19,accountCode:"1102",debitRial:600,creditRial:0},{voucherId:19,accountCode:"5501",debitRial:0,creditRial:100}],
  partyLedger:[{partyId:3,referenceId:reference,debitRial:500,creditRial:0},{partyId:3,referenceId:"FXPAY-REV:8",debitRial:0,creditRial:500}],
  foreignPayments:[payment]
 });
 assert.equal(TreasuryIntegrity.reconcileTreasuryRecords(data).matched,2);
});

test("requires the selected bank/cash account and its asset account type",()=>{
 const wrongCash=input({voucherLines:[{voucherId:10,accountCode:"2101",debitRial:100,creditRial:0},{voucherId:10,accountCode:"1101",debitRial:0,creditRial:100}]});
 assert.ok(TreasuryIntegrity.reconcileTreasuryRecords(wrongCash).rows[0].issues.some(x=>x.includes("حساب یا مبلغ")));
 const wrongType=input({accounts:accounts.map(x=>x.id==="1102"?{...x,type:"LIABILITY"}:x)});
 assert.ok(TreasuryIntegrity.reconcileTreasuryRecords(wrongType).rows[0].issues.some(x=>x.includes("نوع حساب 1102")));
});

test("invalid cash method is reported as an issue without crashing the whole reconciliation",()=>{
 const data=input({treasury:[{id:1,kind:"PAYMENT",method:"رمزارز",partyId:3,amount:100,reference:"TREASURY:1"}]});
 const result=TreasuryIntegrity.reconcileTreasuryRecords(data);
 assert.equal(result.withIssues,1);
 assert.ok(result.rows[0].issues.some(x=>x.includes("روش خزانه باید بانک یا صندوق باشد")));
});

test("foreign payment requires matching currency, exchange rate, payment direction and a valid FX equation",()=>{
 const reference="FXPAY:S7:1",payment={payableId:5,supplierId:3,reference,method:"بانک",currency:"USD",amountMinor:500,fxRateRialPerUnit:120,bookedRial:500,settlementRial:600,fxGainRial:0,fxLossRial:100};
 const good=input({treasury:[{id:8,kind:"PAYMENT",method:"بانک",partyId:3,amount:600,foreignAmountMinor:500,foreignPayableId:5,currency:"USD",fxRateRialPerUnit:120,reference}],vouchers:[{id:18,reference}],voucherLines:[{voucherId:18,accountCode:"2101",debitRial:500,creditRial:0},{voucherId:18,accountCode:"1102",debitRial:0,creditRial:600},{voucherId:18,accountCode:"5501",debitRial:100,creditRial:0}],partyLedger:[{partyId:3,referenceId:reference,debitRial:500,creditRial:0}],foreignPayments:[payment]});
 assert.equal(TreasuryIntegrity.reconcileTreasuryRecords(good).matched,1);
 const wrongCurrency={...good,treasury:good.treasury.map(x=>({...x,currency:"CNY"}))};
 assert.ok(TreasuryIntegrity.reconcileTreasuryRecords(wrongCurrency).rows[0].issues.some(x=>x.includes("ارز، نرخ")));
 const wrongKind={...good,treasury:good.treasury.map(x=>({...x,kind:"RECEIPT"}))};
 assert.ok(TreasuryIntegrity.reconcileTreasuryRecords(wrongKind).rows[0].issues.some(x=>x.includes("ارز، نرخ")));
 const badFx={...good,foreignPayments:[{...payment,fxLossRial:90}]};
 assert.ok(TreasuryIntegrity.reconcileTreasuryRecords(badFx).rows[0].issues.some(x=>x.includes("ارز، نرخ")));
});

const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
test("treasury page uses the reconciliation module and refreshes its PWA asset cache",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.match(app,/HolooTreasuryIntegrity\.reconcileTreasuryRecords\(\{treasury,vouchers,voucherLines,accounts,parties,partyLedger,checks,payroll:payrollRows,foreignPayments\}\)/);
 assert.match(app,/تطبیق خزانه با سند حسابداری و تفصیلی/);
 assert.ok(html.includes("treasury-reconciliation.js?v=treasury-integrity-3"));
 assert.ok(html.indexOf("treasury-reconciliation.js")<html.indexOf("app.js"));
 assert.ok(sw.includes('"./treasury-reconciliation.js"'));
 assert.match(sw,/holloo-pwa-v169-treasury-reconciliation/);
 assert.match(sw,/treasury-reconciliation\\.js/);
});
