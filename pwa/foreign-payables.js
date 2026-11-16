"use strict";
function toSafeMinor(value,label="مبلغ ارزی"){
 const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw new Error(label+" باید عدد صحیح و غیرمنفی باشد");return n;
}
function addSafe(a,b,label="جمع مبلغ"){
 const result=a+b;if(!Number.isSafeInteger(result))throw new Error(label+" از محدوده عددی مجاز خارج است");return result;
}
function subtractSafe(a,b,label="تفریق مبلغ"){
 const result=a-b;if(!Number.isSafeInteger(result))throw new Error(label+" از محدوده عددی مجاز خارج است");return result;
}
function convertMinorAtRate(amountMinor,rate){
 const amount=toSafeMinor(amountMinor),fx=Number(rate);
 if(!Number.isSafeInteger(fx)||fx<=0)throw new Error("نرخ ارز معتبر نیست");
 const rounded=(BigInt(amount)*BigInt(fx)+50n)/100n;
 if(rounded>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("معادل ریالی از محدوده عددی مجاز خارج است");
 return Number(rounded);
}
function createForeignPayable(input){
 const amountMinor=toSafeMinor(input.amountMinor,"مبلغ تعهد ارزی"),rate=Number(input.bookedFxRateRialPerUnit),supplierId=Number(input.supplierId);
 if(!input.sourceNumber||!input.currency||!["USD","CNY","EUR"].includes(input.currency)||!Number.isSafeInteger(rate)||rate<=0||amountMinor<=0||!Number.isSafeInteger(supplierId)||supplierId<=0)throw new Error("اطلاعات تعهد ارزی معتبر نیست");
 const bookedRial=convertMinorAtRate(amountMinor,rate);
 if(!Number.isSafeInteger(bookedRial)||bookedRial<=0)throw new Error("ارزش ریالی تعهد خارج از محدوده مجاز است");
 return {...input,amountMinor,bookedFxRateRialPerUnit:rate,bookedRial,paidMinor:0,bookedRialPaid:0,settlementRialPaid:0,realizedFxGainRial:0,realizedFxLossRial:0,status:"OPEN",createdAt:Number(input.createdAt||Date.now())};
}
function planForeignPayablePayment(input){
 const payable=input.payable,amountMinor=toSafeMinor(input.amountMinor,"مبلغ پرداخت ارزی"),rate=Number(input.fxRateRialPerUnit),date=Number(input.date||Date.now());
 if(!payable||payable.status==="CANCELLED"||!Number.isSafeInteger(rate)||rate<=0||!Number.isSafeInteger(date)||date<=0||amountMinor<=0)throw new Error("اطلاعات پرداخت ارزی معتبر نیست");
 const totalMinor=toSafeMinor(payable.amountMinor,"کل تعهد ارزی"),paidMinor=toSafeMinor(payable.paidMinor||0,"مبلغ پرداخت‌شده ارزی");
 const totalBookedRial=toSafeMinor(payable.bookedRial,"ارزش دفتری تعهد"),bookedPaidRial=toSafeMinor(payable.bookedRialPaid||0,"ارزش دفتری تسویه‌شده");
 const settlementPaidRial=toSafeMinor(payable.settlementRialPaid||0,"جمع پرداخت ریالی");
 const bookedRate=Number(payable.bookedFxRateRialPerUnit);
 if(!Number.isSafeInteger(bookedRate)||bookedRate<=0||paidMinor>=totalMinor||bookedPaidRial>totalBookedRial)throw new Error("مانده یا نرخ تعهد ارزی برای پرداخت معتبر نیست");
 const outstanding=totalMinor-paidMinor;
 if(amountMinor>outstanding)throw new Error("مبلغ پرداخت از مانده تعهد ارزی بیشتر است");
 const nextPaid=addSafe(paidMinor,amountMinor,"جمع پرداخت ارزی");
 const nextBookedPaid=nextPaid===totalMinor?totalBookedRial:convertMinorAtRate(nextPaid,bookedRate);
 const bookedRial=subtractSafe(nextBookedPaid,bookedPaidRial,"ارزش دفتری قسط");
 const settlementRial=convertMinorAtRate(amountMinor,rate);
 if(bookedRial<=0||settlementRial<=0)throw new Error("معادل ریالی پرداخت معتبر نیست");
 const fxGainRial=Math.max(0,bookedRial-settlementRial),fxLossRial=Math.max(0,settlementRial-bookedRial);
 const payment={payableId:payable.id,sourceNumber:payable.sourceNumber,supplierId:payable.supplierId,supplierName:payable.supplierName,currency:payable.currency,amountMinor,fxRateRialPerUnit:rate,bookedRial,settlementRial,fxGainRial,fxLossRial,date,reference:String(input.reference||("FXPAY:"+payable.sourceNumber+":"+date)),method:input.method||"بانک",note:String(input.note||"")};
 const updated={...payable,paidMinor:nextPaid,bookedRialPaid:nextBookedPaid,settlementRialPaid:addSafe(settlementPaidRial,settlementRial,"جمع پرداخت ریالی"),realizedFxGainRial:addSafe(toSafeMinor(payable.realizedFxGainRial||0,"سود تسعیر تحقق‌یافته"),fxGainRial,"جمع سود تسعیر"),realizedFxLossRial:addSafe(toSafeMinor(payable.realizedFxLossRial||0,"زیان تسعیر تحقق‌یافته"),fxLossRial,"جمع زیان تسعیر"),status:nextPaid===Number(payable.amountMinor)?"PAID":"PARTIAL",lastPaymentAt:date};
 return {payment,updated,bookedRial,settlementRial,fxGainRial,fxLossRial,remainingMinor:Number(updated.amountMinor)-nextPaid};
}
function summarizeForeignPayable(input){
 const payable=input.payable,payments=Array.isArray(input.payments)?input.payments:[],rate=Number(input.currentFxRateRialPerUnit||payable.bookedFxRateRialPerUnit);
 const amountMinor=toSafeMinor(payable.amountMinor,"کل تعهد ارزی"),paidMinor=toSafeMinor(payable.paidMinor||0,"مبلغ پرداخت‌شده ارزی");
 const bookedRialTotal=toSafeMinor(payable.bookedRial,"ارزش دفتری تعهد"),bookedRialPaid=toSafeMinor(payable.bookedRialPaid||0,"ارزش دفتری تسویه‌شده");
 if(paidMinor>amountMinor||bookedRialPaid>bookedRialTotal||!Number.isSafeInteger(rate)||rate<=0)throw new Error("مانده یا نرخ ارزش‌گذاری تعهد معتبر نیست");
 const remainingMinor=amountMinor-paidMinor,bookValue=bookedRialTotal-bookedRialPaid;
 const revaluedRial=convertMinorAtRate(remainingMinor,rate),delta=subtractSafe(revaluedRial,bookValue,"اختلاف ارزش‌گذاری ارزی");
 const activePayments=payments.filter(p=>p&&p.status!=="REVERSED");
 const realizedFxGainRial=activePayments.reduce((n,p)=>addSafe(n,toSafeMinor(p.fxGainRial||0,"سود تسعیر پرداخت"),"جمع سود تسعیر پرداخت‌ها"),0);
 const realizedFxLossRial=activePayments.reduce((n,p)=>addSafe(n,toSafeMinor(p.fxLossRial||0,"زیان تسعیر پرداخت"),"جمع زیان تسعیر پرداخت‌ها"),0);
 return {...payable,remainingMinor,bookValue,revaluedRial,unrealizedFxLossRial:Math.max(0,delta),unrealizedFxGainRial:Math.max(0,-delta),realizedFxGainRial,realizedFxLossRial};
}

function planForeignPayableReversal(input){
 const payable=input.payable,payment=input.payment,date=Number(input.date||Date.now());
 if(!payable||!payment||payment.status==="REVERSED"||Number(payment.payableId)!==Number(payable.id)||!Number.isSafeInteger(date)||date<=0)throw new Error("پرداخت برای برگشت معتبر نیست یا قبلاً برگشت خورده است");
 const paidMinor=toSafeMinor(payable.paidMinor||0,"مبلغ پرداخت‌شده ارزی"),amountMinor=toSafeMinor(payment.amountMinor,"مبلغ قسط ارزی");
 const bookedPaid=toSafeMinor(payable.bookedRialPaid||0,"ارزش دفتری تسویه‌شده"),bookedRial=toSafeMinor(payment.bookedRial,"ارزش دفتری قسط");
 const settlementPaid=toSafeMinor(payable.settlementRialPaid||0,"جمع پرداخت ریالی"),settlementRial=toSafeMinor(payment.settlementRial,"مبلغ ریالی قسط");
 const gainPaid=toSafeMinor(payable.realizedFxGainRial||0,"سود تسعیر ثبت‌شده"),gain=toSafeMinor(payment.fxGainRial||0,"سود تسعیر قسط");
 const lossPaid=toSafeMinor(payable.realizedFxLossRial||0,"زیان تسعیر ثبت‌شده"),loss=toSafeMinor(payment.fxLossRial||0,"زیان تسعیر قسط");
 if(amountMinor<=0||bookedRial<=0||settlementRial<=0||paidMinor<amountMinor||bookedPaid<bookedRial||settlementPaid<settlementRial||gainPaid<gain||lossPaid<loss)throw new Error("مانده تعهد برای برگشت این پرداخت کافی نیست");
 const nextPaid=subtractSafe(paidMinor,amountMinor,"مانده پرداخت ارزی");
 const updated={...payable,paidMinor:nextPaid,bookedRialPaid:subtractSafe(bookedPaid,bookedRial,"مانده ارزش دفتری"),settlementRialPaid:subtractSafe(settlementPaid,settlementRial,"مانده پرداخت ریالی"),realizedFxGainRial:subtractSafe(gainPaid,gain,"مانده سود تسعیر"),realizedFxLossRial:subtractSafe(lossPaid,loss,"مانده زیان تسعیر"),status:nextPaid===0?"OPEN":"PARTIAL",lastPaymentAt:date};
 const reversedPayment={...payment,status:"REVERSED",reversedAt:date};
 return {updated,reversedPayment,bookedRial:Number(payment.bookedRial),settlementRial:Number(payment.settlementRial),fxGainRial:Number(payment.fxGainRial||0),fxLossRial:Number(payment.fxLossRial||0)};
}
function summarizeForeignPayablesForecast(input){
 const rows=Array.isArray(input.payables)?input.payables:[],asOf=Number(input.asOf||Date.now()),days=Number(input.horizonDays===undefined?30:input.horizonDays);
 if(!Number.isFinite(asOf)||!Number.isSafeInteger(days)||days<0||days>366)throw new Error("بازه پیش‌بینی سررسید معتبر نیست");
 const start=new Date(asOf);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+days+1);
 const result={asOf:start.getTime(),horizonDays:days,openCount:0,overdueCount:0,dueSoonCount:0,byCurrency:{}};
 for(const p of rows){
  if(!p||p.status==="CANCELLED"||p.status==="PAID")continue;
  const amount=toSafeMinor(Number(p.amountMinor)-Number(p.paidMinor||0),"مانده تعهد ارزی");
  if(!amount)continue;
  const currency=String(p.currency||"");if(!["USD","CNY","EUR"].includes(currency))continue;
  if(!result.byCurrency[currency])result.byCurrency[currency]={outstandingMinor:0,overdueMinor:0,dueSoonMinor:0,overdueCount:0,dueSoonCount:0,undatedMinor:0};
  const bucket=result.byCurrency[currency];bucket.outstandingMinor=addSafe(bucket.outstandingMinor,amount,"جمع مانده تعهدات ارزی");result.openCount++;
  const due=Number(p.dueDate||0);
  if(!Number.isFinite(due)||due<=0){bucket.undatedMinor=addSafe(bucket.undatedMinor,amount,"جمع تعهدات بدون سررسید");continue}
  if(due<start.getTime()){bucket.overdueMinor=addSafe(bucket.overdueMinor,amount,"جمع تعهدات سررسیدگذشته");bucket.overdueCount++;result.overdueCount++}
  else if(due<end.getTime()){bucket.dueSoonMinor=addSafe(bucket.dueSoonMinor,amount,"جمع تعهدات سررسیدشونده");bucket.dueSoonCount++;result.dueSoonCount++}
 }
 return result;
}
const ForeignPayables={createForeignPayable,planForeignPayablePayment,planForeignPayableReversal,summarizeForeignPayable,summarizeForeignPayablesForecast};
if(typeof module!=="undefined")module.exports=ForeignPayables;
if(typeof globalThis!=="undefined")globalThis.HolooForeignPayables=ForeignPayables;
