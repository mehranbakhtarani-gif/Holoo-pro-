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


test("adds supplier installment plans without posting payment and prevents over-planning",()=>{\n const {planForeignPayableInstallment,clearForeignPayableInstallmentPlan}=require("../foreign-payables.js"),p=payable(),first=planForeignPayableInstallment({payable:p,amountMinor:25000,dueDate:1000,createdAt:2000}),second=planForeignPayableInstallment({payable:first,amountMinor:50000,dueDate:2000,createdAt:3000});\n assert.equal(second.paymentPlan.length,2);assert.equal(second.paidMinor,0);assert.equal(second.status,"OPEN");assert.throws(()=>planForeignPayableInstallment({payable:second,amountMinor:25001,dueDate:3000}),/بیشتر/);\n const cleared=clearForeignPayableInstallmentPlan(second);assert.deepEqual(cleared.paymentPlan,[]);assert.equal(cleared.paidMinor,0);\n assert.throws(()=>planForeignPayableInstallment({payable:p,amountMinor:100,dueDate:0}),/معتبر/);\n});\n\ntest("cash flow uses planned installments and keeps unplanned balance on contractual due date",()=>{\n const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");\n assert.match(app,/planForeignPayableInstallment/);assert.match(app,/قسط برنامه‌ریزی‌شده تعهد ارزی/);assert.match(app,/مانده برنامه‌ریزی‌نشده تعهد ارزی/);assert.match(app,/data-fx-plan-add/);assert.match(app,/data-fx-plan-clear/);\n});\n