"use strict";
function toSafeMinor(value,label="مبلغ ارزی"){
 const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw new Error(label+" باید عدد صحیح و غیرمنفی باشد");return n;
}
function createForeignPayable(input){
 const amountMinor=toSafeMinor(input.amountMinor,"مبلغ تعهد ارزی"),rate=Number(input.bookedFxRateRialPerUnit),supplierId=Number(input.supplierId);
 if(!input.sourceNumber||!input.currency||!["USD","CNY","EUR"].includes(input.currency)||!Number.isSafeInteger(rate)||rate<=0||amountMinor<=0||!Number.isSafeInteger(supplierId)||supplierId<=0)throw new Error("اطلاعات تعهد ارزی معتبر نیست");
 const bookedRial=Math.round(amountMinor*rate/100);
 if(!Number.isSafeInteger(bookedRial)||bookedRial<=0)throw new Error("ارزش ریالی تعهد خارج از محدوده مجاز است");
 return {...input,amountMinor,bookedFxRateRialPerUnit:rate,bookedRial,paidMinor:0,bookedRialPaid:0,settlementRialPaid:0,realizedFxGainRial:0,realizedFxLossRial:0,status:"OPEN",createdAt:Number(input.createdAt||Date.now())};
}
function planForeignPayablePayment(input){
 const payable=input.payable,amountMinor=toSafeMinor(input.amountMinor,"مبلغ پرداخت ارزی"),rate=Number(input.fxRateRialPerUnit),date=Number(input.date||Date.now());
 if(!payable||payable.status==="CANCELLED"||!Number.isSafeInteger(rate)||rate<=0||amountMinor<=0)throw new Error("اطلاعات پرداخت ارزی معتبر نیست");
 const outstanding=Number(payable.amountMinor)-Number(payable.paidMinor||0);
 if(amountMinor>outstanding)throw new Error("مبلغ پرداخت از مانده تعهد ارزی بیشتر است");
 const nextPaid=Number(payable.paidMinor||0)+amountMinor;
 const nextBookedPaid=nextPaid===Number(payable.amountMinor)?Number(payable.bookedRial):Math.round(Number(payable.bookedRial)*nextPaid/Number(payable.amountMinor));
 const bookedRial=nextBookedPaid-Number(payable.bookedRialPaid||0);
 const settlementRial=Math.round(amountMinor*rate/100);
 if(!Number.isSafeInteger(bookedRial)||bookedRial<=0||!Number.isSafeInteger(settlementRial)||settlementRial<=0)throw new Error("معادل ریالی پرداخت معتبر نیست");
 const fxGainRial=Math.max(0,bookedRial-settlementRial),fxLossRial=Math.max(0,settlementRial-bookedRial);
 const payment={payableId:payable.id,sourceNumber:payable.sourceNumber,supplierId:payable.supplierId,supplierName:payable.supplierName,currency:payable.currency,amountMinor,fxRateRialPerUnit:rate,bookedRial,settlementRial,fxGainRial,fxLossRial,date,reference:String(input.reference||("FXPAY:"+payable.sourceNumber+":"+date)),method:input.method||"بانک",note:String(input.note||"")};
 const updated={...payable,paidMinor:nextPaid,bookedRialPaid:nextBookedPaid,settlementRialPaid:Number(payable.settlementRialPaid||0)+settlementRial,realizedFxGainRial:Number(payable.realizedFxGainRial||0)+fxGainRial,realizedFxLossRial:Number(payable.realizedFxLossRial||0)+fxLossRial,status:nextPaid===Number(payable.amountMinor)?"PAID":"PARTIAL",lastPaymentAt:date};
 return {payment,updated,bookedRial,settlementRial,fxGainRial,fxLossRial,remainingMinor:Number(updated.amountMinor)-nextPaid};
}
function summarizeForeignPayable(input){
 const payable=input.payable,payments=Array.isArray(input.payments)?input.payments:[],rate=Number(input.currentFxRateRialPerUnit||payable.bookedFxRateRialPerUnit);
 const remainingMinor=Number(payable.amountMinor)-Number(payable.paidMinor||0),bookValue=Number(payable.bookedRial)-Number(payable.bookedRialPaid||0);
 const revaluedRial=Math.round(remainingMinor*rate/100),delta=revaluedRial-bookValue;
 return {...payable,remainingMinor,bookValue,revaluedRial,unrealizedFxLossRial:Math.max(0,delta),unrealizedFxGainRial:Math.max(0,-delta),realizedFxGainRial:payments.reduce((n,p)=>n+Number(p.fxGainRial||0),0),realizedFxLossRial:payments.reduce((n,p)=>n+Number(p.fxLossRial||0),0)};
}

function planForeignPayableReversal(input){
 const payable=input.payable,payment=input.payment,date=Number(input.date||Date.now());
 if(!payable||!payment||payment.status==="REVERSED"||Number(payment.payableId)!==Number(payable.id))throw new Error("پرداخت برای برگشت معتبر نیست یا قبلاً برگشت خورده است");
 if(Number(payable.paidMinor||0)<Number(payment.amountMinor)||Number(payable.bookedRialPaid||0)<Number(payment.bookedRial))throw new Error("مانده تعهد برای برگشت این پرداخت کافی نیست");
 const updated={...payable,paidMinor:Number(payable.paidMinor)-Number(payment.amountMinor),bookedRialPaid:Number(payable.bookedRialPaid)-Number(payment.bookedRial),settlementRialPaid:Number(payable.settlementRialPaid)-Number(payment.settlementRial),realizedFxGainRial:Number(payable.realizedFxGainRial||0)-Number(payment.fxGainRial||0),realizedFxLossRial:Number(payable.realizedFxLossRial||0)-Number(payment.fxLossRial||0),status:Number(payable.paidMinor)-Number(payment.amountMinor)===0?"OPEN":"PARTIAL",lastPaymentAt:date};
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
  const bucket=result.byCurrency[currency];bucket.outstandingMinor+=amount;result.openCount++;
  const due=Number(p.dueDate||0);
  if(!Number.isFinite(due)||due<=0){bucket.undatedMinor+=amount;continue}
  if(due<start.getTime()){bucket.overdueMinor+=amount;bucket.overdueCount++;result.overdueCount++}
  else if(due<end.getTime()){bucket.dueSoonMinor+=amount;bucket.dueSoonCount++;result.dueSoonCount++}
 }
 return result;
}
const ForeignPayables={createForeignPayable,planForeignPayablePayment,planForeignPayableReversal,summarizeForeignPayable,summarizeForeignPayablesForecast};
if(typeof module!=="undefined")module.exports=ForeignPayables;
if(typeof globalThis!=="undefined")globalThis.HolooForeignPayables=ForeignPayables;
