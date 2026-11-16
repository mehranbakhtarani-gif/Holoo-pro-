const test=require("node:test");const assert=require("node:assert/strict");
const {createForeignPayable,planForeignPayablePayment,planForeignPayableReversal,summarizeForeignPayable}=require("../foreign-payables.js");
const payable=()=>({...createForeignPayable({sourceType:"IMPORT_SHIPMENT",sourceId:7,sourceNumber:"IMP-007",container:"MSCU123",supplierId:2,supplierName:"تأمین‌کننده چین",currency:"USD",amountMinor:100000,bookedFxRateRialPerUnit:600000,dueDate:500}),id:12});
test("creates a supplier obligation at the original booking FX rate",()=>{const p=payable();assert.equal(p.bookedRial,600000000);assert.equal(p.paidMinor,0);assert.equal(p.status,"OPEN")});
test("calculates partial settlement and realized FX gain for a foreign-currency liability",()=>{const p=payable(),x=planForeignPayablePayment({payable:p,amountMinor:25000,fxRateRialPerUnit:550000,date:600});assert.equal(x.bookedRial,150000000);assert.equal(x.settlementRial,137500000);assert.equal(x.fxGainRial,12500000);assert.equal(x.fxLossRial,0);assert.equal(x.remainingMinor,75000);assert.equal(x.updated.status,"PARTIAL")});
test("calculates realized FX loss when settlement rate rises",()=>{const p=payable(),x=planForeignPayablePayment({payable:p,amountMinor:100000,fxRateRialPerUnit:650000});assert.equal(x.bookedRial,600000000);assert.equal(x.settlementRial,650000000);assert.equal(x.fxLossRial,50000000);assert.equal(x.updated.status,"PAID")});
test("allocates booked liability cumulatively without rounding drift across installments",()=>{let p=payable(),a=planForeignPayablePayment({payable:p,amountMinor:33333,fxRateRialPerUnit:600000});p=a.updated;let b=planForeignPayablePayment({payable:p,amountMinor:33333,fxRateRialPerUnit:600000});p=b.updated;let c=planForeignPayablePayment({payable:p,amountMinor:33334,fxRateRialPerUnit:600000});assert.equal(a.bookedRial+b.bookedRial+c.bookedRial,600000000);assert.equal(c.updated.bookedRialPaid,600000000)});
test("revalues only the outstanding liability and separates realized and unrealized FX",()=>{const p=payable(),x=planForeignPayablePayment({payable:p,amountMinor:25000,fxRateRialPerUnit:550000});const s=summarizeForeignPayable({payable:x.updated,payments:[x.payment],currentFxRateRialPerUnit:620000});assert.equal(s.remainingMinor,75000);assert.equal(s.bookValue,450000000);assert.equal(s.revaluedRial,465000000);assert.equal(s.unrealizedFxLossRial,15000000);assert.equal(s.realizedFxGainRial,12500000)});
test("rejects overpayment, unsupported currencies and invalid rates",()=>{assert.throws(()=>createForeignPayable({sourceNumber:"x",supplierId:1,currency:"IRR",amountMinor:100,bookedFxRateRialPerUnit:1}),/معتبر/);const p=payable();assert.throws(()=>planForeignPayablePayment({payable:p,amountMinor:100001,fxRateRialPerUnit:1}),/بیشتر/);assert.throws(()=>planForeignPayablePayment({payable:p,amountMinor:100,fxRateRialPerUnit:0}),/معتبر/);});


test("reverses a posted installment and restores the outstanding payable balances",()=>{
 const p=payable(),posted=planForeignPayablePayment({payable:p,amountMinor:25000,fxRateRialPerUnit:550000,date:600}),reversed=planForeignPayableReversal({payable:posted.updated,payment:posted.payment,date:700});
 assert.equal(reversed.updated.paidMinor,0);assert.equal(reversed.updated.bookedRialPaid,0);assert.equal(reversed.updated.settlementRialPaid,0);
 assert.equal(reversed.updated.realizedFxGainRial,0);assert.equal(reversed.updated.status,"OPEN");assert.equal(reversed.reversedPayment.status,"REVERSED");
 assert.throws(()=>planForeignPayableReversal({payable:reversed.updated,payment:reversed.reversedPayment}),/قبلاً برگشت/);
});

test("PWA wires foreign payable pages, IndexedDB stores, offline cache and FX accounting",()=>{
 const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"..");
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8"),html=fs.readFileSync(path.join(root,"index.html"),"utf8"),sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.match(app,/DB_VERSION=11/);assert.match(app,/"foreignPayables","foreignPayablePayments"/);
 assert.match(app,/createForeignPayable\(/);assert.match(app,/summarizeForeignPayablesForecast\(/);assert.match(app,/planForeignPayablePayment\(/);assert.match(app,/reverseForeignPayablePaymentPwa\(/);assert.match(app,/data-fx-payment-reverse/);
 assert.match(app,/sourceNumber/);assert.match(app,/sourceShipment\?\.receivedAt/);assert.match(app,/shipmentReceivedAt/);assert.match(app,/fxGainRial/);assert.match(app,/fxLossRial/);
 assert.match(app,/foreignRateOverrides/);assert.match(app,/foreignPayablePayments/);
 assert.match(html,/foreign-payables\.js\?v=foreign-payables-1/);
 assert.ok(html.indexOf("foreign-payables.js")<html.indexOf("app.js?v=operation-date-1"));
 assert.match(sw,/\.\/foreign-payables\.js/);assert.match(sw,/foreign-payables\.js/);
});

test("forecasts open supplier obligations by currency and due-date window without mixing currencies",()=>{
 const asOf=new Date(2026,10,16,10).getTime(),day=n=>new Date(2026,10,n,12).getTime();
 const rows=[
  {...payable(),id:1,dueDate:day(10)},
  {...payable(),id:2,currency:"USD",amountMinor:50000,paidMinor:10000,dueDate:day(20)},
  {...payable(),id:3,currency:"CNY",amountMinor:70000,dueDate:day(30)},
  {...payable(),id:4,currency:"EUR",amountMinor:90000,dueDate:null},
  {...payable(),id:5,currency:"USD",status:"PAID",paidMinor:100000,dueDate:day(20)}
 ];
 const x=require("../foreign-payables.js").summarizeForeignPayablesForecast({payables:rows,asOf,horizonDays:30});
 assert.equal(x.openCount,4);assert.equal(x.overdueCount,1);assert.equal(x.dueSoonCount,2);
 assert.equal(x.byCurrency.USD.outstandingMinor,140000);assert.equal(x.byCurrency.USD.overdueMinor,100000);assert.equal(x.byCurrency.USD.dueSoonMinor,40000);
 assert.equal(x.byCurrency.CNY.dueSoonMinor,70000);assert.equal(x.byCurrency.EUR.undatedMinor,90000);
 assert.throws(()=>require("../foreign-payables.js").summarizeForeignPayablesForecast({payables:rows,asOf,horizonDays:400}),/معتبر/);
});


test("adds supplier installment plans without posting payment and prevents over-planning",()=>{
 const {planForeignPayableInstallment,clearForeignPayableInstallmentPlan}=require("../foreign-payables.js"),p=payable(),first=planForeignPayableInstallment({payable:p,amountMinor:25000,dueDate:1000,createdAt:2000}),second=planForeignPayableInstallment({payable:first,amountMinor:50000,dueDate:2000,createdAt:3000});
 assert.equal(second.paymentPlan.length,2);assert.equal(second.paidMinor,0);assert.equal(second.status,"OPEN");assert.throws(()=>planForeignPayableInstallment({payable:second,amountMinor:25001,dueDate:3000}),/بیشتر/);
 const cleared=clearForeignPayableInstallmentPlan(second);assert.deepEqual(cleared.paymentPlan,[]);assert.equal(cleared.paidMinor,0);
 assert.throws(()=>planForeignPayableInstallment({payable:p,amountMinor:100,dueDate:0}),/معتبر/);
});

test("cash flow uses planned installments and keeps unplanned balance on contractual due date",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
 assert.match(app,/planForeignPayableInstallment/);assert.match(app,/قسط برنامه‌ریزی‌شده تعهد ارزی/);assert.match(app,/مانده برنامه‌ریزی‌نشده تعهد ارزی/);assert.match(app,/data-fx-plan-add/);assert.match(app,/data-fx-plan-clear/);
});


test("reduces scheduled installments by payments made after the plan was created",()=>{
 const {planForeignPayableInstallment,getRemainingForeignPayableInstallments}=require("../foreign-payables.js"),p=payable(),planned=planForeignPayableInstallment({payable:p,amountMinor:60000,dueDate:1000,createdAt:2000}),paid=planForeignPayablePayment({payable:planned,amountMinor:25000,fxRateRialPerUnit:600000,date:3000}).updated;
 assert.equal(paid.paymentPlanBasePaidMinor,0);assert.equal(getRemainingForeignPayableInstallments(paid)[0].amountMinor,35000);
 const alreadyPaid=planForeignPayableInstallment({payable:{...p,paidMinor:20000},amountMinor:50000,dueDate:1000,createdAt:4000});
 assert.equal(alreadyPaid.paymentPlanBasePaidMinor,20000);assert.equal(getRemainingForeignPayableInstallments(alreadyPaid)[0].amountMinor,50000);
});

test("allocates actual foreign payments FIFO to planned installments and leaves excess unplanned",()=>{
 const {planForeignPayableInstallment,planForeignPayablePayment,getRemainingForeignPayableInstallments}=require("../foreign-payables.js");
 const p=payable(),a=planForeignPayableInstallment({payable:p,amountMinor:20000,dueDate:1000,createdAt:2000}),b=planForeignPayableInstallment({payable:a,amountMinor:30000,dueDate:2000,createdAt:3000});
 const posted=planForeignPayablePayment({payable:b,amountMinor:40000,fxRateRialPerUnit:600000,date:4000});
 assert.deepEqual(posted.payment.planAllocations,[{dueDate:1000,amountMinor:20000,note:""},{dueDate:2000,amountMinor:20000,note:""}]);
 assert.equal(posted.payment.unplannedAmountMinor,0);
 assert.deepEqual(getRemainingForeignPayableInstallments(posted.updated),[{amountMinor:10000,dueDate:2000,note:"",createdAt:3000}]);
 const over=planForeignPayablePayment({payable:b,amountMinor:60000,fxRateRialPerUnit:600000,date:5000});
 assert.equal(over.payment.planAllocations.reduce((n,x)=>n+x.amountMinor,0),50000);
 assert.equal(over.payment.unplannedAmountMinor,10000);
});
test("reversing a payment restores its scheduled installment allocation",()=>{
 const {planForeignPayableInstallment,planForeignPayablePayment,planForeignPayableReversal,getRemainingForeignPayableInstallments}=require("../foreign-payables.js");
 const p=payable(),scheduled=planForeignPayableInstallment({payable:p,amountMinor:45000,dueDate:1000,createdAt:2000}),posted=planForeignPayablePayment({payable:scheduled,amountMinor:25000,fxRateRialPerUnit:600000,date:3000});
 assert.equal(getRemainingForeignPayableInstallments(posted.updated)[0].amountMinor,20000);
 const reversed=planForeignPayableReversal({payable:posted.updated,payment:posted.payment,date:4000});
 assert.equal(getRemainingForeignPayableInstallments(reversed.updated)[0].amountMinor,45000);
});

test("reconciles foreign payable payment against treasury, supplier ledger and balanced journal",()=>{
 const {reconcileForeignPayablePayments}=require("../foreign-payables.js");
 const payment={id:9,payableId:12,supplierId:2,sourceNumber:"IMP-007",reference:"FXPAY:12:900",status:"POSTED",amountMinor:25000,bookedRial:150000000,settlementRial:137500000,fxGainRial:12500000,fxLossRial:0};
 const data={payments:[payment],treasury:[{reference:payment.reference,kind:"PAYMENT",amount:payment.settlementRial,foreignAmountMinor:payment.amountMinor,foreignPayableId:payment.payableId}],partyLedger:[{referenceId:payment.reference,partyId:2,debitRial:payment.bookedRial,creditRial:0}],vouchers:[{id:31,reference:payment.reference}],voucherLines:[{voucherId:31,accountCode:"2101",debitRial:150000000,creditRial:0},{voucherId:31,accountCode:"1102",debitRial:0,creditRial:137500000},{voucherId:31,accountCode:"4301",debitRial:0,creditRial:12500000}]};
 const result=reconcileForeignPayablePayments(data);
 assert.deepEqual({total:result.total,matched:result.matched,withIssues:result.withIssues},{total:1,matched:1,withIssues:0});
 const broken=reconcileForeignPayablePayments({...data,treasury:[]});
 assert.equal(broken.withIssues,1);assert.match(broken.rows[0].issues.join(" "),/خزانه پیدا نشد/);
});
test("detects duplicate and mismatched foreign payment accounting records",()=>{
 const {reconcileForeignPayablePayments}=require("../foreign-payables.js");
 const payment={id:10,payableId:12,supplierId:2,sourceNumber:"IMP-008",reference:"FXPAY:12:901",status:"POSTED",amountMinor:10000,bookedRial:60000000,settlementRial:65000000,fxGainRial:0,fxLossRial:5000000};
 const data={payments:[payment],treasury:[{reference:payment.reference,kind:"PAYMENT",amount:1,foreignAmountMinor:payment.amountMinor,foreignPayableId:payment.payableId},{reference:payment.reference,kind:"PAYMENT",amount:1,foreignAmountMinor:payment.amountMinor,foreignPayableId:payment.payableId}],partyLedger:[{referenceId:payment.reference,partyId:2,debitRial:payment.bookedRial,creditRial:0}],vouchers:[{id:32,reference:payment.reference}],voucherLines:[{voucherId:32,accountCode:"2101",debitRial:60000000,creditRial:0},{voucherId:32,accountCode:"1102",debitRial:0,creditRial:65000000},{voucherId:32,accountCode:"5501",debitRial:5000000,creditRial:0}]};
 const result=reconcileForeignPayablePayments(data);
 assert.equal(result.withIssues,1);assert.match(result.rows[0].issues.join(" "),/تکراری/);\n const mismatch=reconcileForeignPayablePayments({...data,treasury:[data.treasury[0]]});assert.match(mismatch.rows[0].issues.join(" "),/مغایر/);
});
test("reconciles reversed foreign payable payments including reversal voucher and cash receipt",()=>{
 const {reconcileForeignPayablePayments}=require("../foreign-payables.js");
 const payment={id:11,payableId:12,supplierId:2,sourceNumber:"IMP-009",reference:"FXPAY:12:902",status:"REVERSED",amountMinor:25000,bookedRial:150000000,settlementRial:137500000,fxGainRial:12500000,fxLossRial:0};
 const data={payments:[payment],treasury:[{reference:payment.reference,kind:"PAYMENT",amount:137500000,foreignAmountMinor:25000,foreignPayableId:12,status:"REVERSED"},{reference:"FXPAY-REV:11",kind:"RECEIPT",amount:137500000}],partyLedger:[{referenceId:payment.reference,partyId:2,debitRial:150000000,creditRial:0},{referenceId:"FXPAY-REV:11",partyId:2,debitRial:0,creditRial:150000000}],vouchers:[{id:33,reference:payment.reference},{id:34,reference:"FXPAY-REV:11"}],voucherLines:[{voucherId:33,accountCode:"2101",debitRial:150000000,creditRial:0},{voucherId:33,accountCode:"1102",debitRial:0,creditRial:137500000},{voucherId:33,accountCode:"4301",debitRial:0,creditRial:12500000},{voucherId:34,accountCode:"1102",debitRial:137500000,creditRial:0},{voucherId:34,accountCode:"4301",debitRial:12500000,creditRial:0},{voucherId:34,accountCode:"2101",debitRial:0,creditRial:150000000}]};
 const result=reconcileForeignPayablePayments(data);
 assert.equal(result.matched,1);assert.equal(result.withIssues,0);
});
