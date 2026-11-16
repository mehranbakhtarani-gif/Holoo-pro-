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
 const planAllocations=allocateForeignPayablePaymentToInstallments(payable,amountMinor);
 const payment={payableId:payable.id,sourceNumber:payable.sourceNumber,supplierId:payable.supplierId,supplierName:payable.supplierName,currency:payable.currency,amountMinor,fxRateRialPerUnit:rate,bookedRial,settlementRial,fxGainRial,fxLossRial,date,reference:String(input.reference||("FXPAY:"+payable.sourceNumber+":"+date)),method:input.method||"بانک",note:String(input.note||""),planAllocations,unplannedAmountMinor:amountMinor-planAllocations.reduce((n,x)=>n+x.amountMinor,0)};
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
function planForeignPayableInstallment(input){
 const payable=input.payable,amountMinor=toSafeMinor(input.amountMinor,"مبلغ قسط"),dueDate=Number(input.dueDate);
 if(!payable||payable.status==="CANCELLED"||payable.status==="PAID"||!Number.isSafeInteger(dueDate)||dueDate<=0||amountMinor<=0)throw new Error("اطلاعات قسط معتبر نیست");
 const outstanding=Number(payable.amountMinor)-Number(payable.paidMinor||0),existing=Array.isArray(payable.paymentPlan)?payable.paymentPlan:[];
 const planned=existing.reduce((n,x)=>n+toSafeMinor(x.amountMinor,"مبلغ قسط برنامه‌ریزی‌شده"),0);
 if(planned+amountMinor>outstanding)throw new Error("جمع اقساط برنامه‌ریزی‌شده از مانده تعهد بیشتر است");
 const installment={amountMinor,dueDate,note:String(input.note||""),createdAt:Number(input.createdAt||Date.now())};
 const basePaid=existing.length?Number(payable.paymentPlanBasePaidMinor??payable.paidMinor??0):Number(payable.paidMinor||0);
 return {...payable,paymentPlan:[...existing,installment],paymentPlanBasePaidMinor:basePaid,paymentPlanUpdatedAt:Number(input.createdAt||Date.now())};
}
function getRemainingForeignPayableInstallments(payable){
 const plan=Array.isArray(payable?.paymentPlan)?payable.paymentPlan:[],baseline=Number(payable?.paymentPlanBasePaidMinor??payable?.paidMinor??0);
 let consumed=Math.max(0,Number(payable?.paidMinor||0)-baseline);
 const remaining=[];
 for(const item of plan){const amount=toSafeMinor(item.amountMinor,"مبلغ قسط");const used=Math.min(amount,consumed);consumed-=used;if(amount>used)remaining.push({...item,amountMinor:amount-used})}
 return remaining;
}
function allocateForeignPayablePaymentToInstallments(payable,paymentAmountMinor){
 const amount=toSafeMinor(paymentAmountMinor,"مبلغ پرداخت ارزی");let remaining=amount;const allocations=[];
 for(const item of getRemainingForeignPayableInstallments(payable)){if(!remaining)break;const allocated=Math.min(remaining,item.amountMinor);if(allocated>0){allocations.push({dueDate:Number(item.dueDate),amountMinor:allocated,note:String(item.note||"")});remaining-=allocated}}
 return allocations;
}
function clearForeignPayableInstallmentPlan(payable){
 if(!payable||!Array.isArray(payable.paymentPlan)||!payable.paymentPlan.length)throw new Error("برنامه پرداختی برای حذف وجود ندارد");
 return {...payable,paymentPlan:[],paymentPlanUpdatedAt:Date.now()};
}
function reconcileForeignPayablePayments(input){
 const payments=Array.isArray(input.payments)?input.payments:[],treasury=Array.isArray(input.treasury)?input.treasury:[],partyLedger=Array.isArray(input.partyLedger)?input.partyLedger:[],vouchers=Array.isArray(input.vouchers)?input.vouchers:[],voucherLines=Array.isArray(input.voucherLines)?input.voucherLines:[];
 const rows=payments.map(payment=>{
  const reference=String(payment.reference||""),active=payment.status!=="REVERSED",originalTreasury=treasury.filter(x=>x.reference===reference),originalLedger=partyLedger.filter(x=>x.referenceId===reference),originalVouchers=vouchers.filter(x=>x.reference===reference),voucher=originalVouchers[0],lines=voucher?voucherLines.filter(x=>Number(x.voucherId)===Number(voucher.id)):[];
  const reversalReference="FXPAY-REV:"+payment.id,reversalTreasury=treasury.filter(x=>x.reference===reversalReference),reversalLedger=partyLedger.filter(x=>x.referenceId===reversalReference),reversalVouchers=vouchers.filter(x=>x.reference===reversalReference),reversalVoucher=reversalVouchers[0],reversalLines=reversalVoucher?voucherLines.filter(x=>Number(x.voucherId)===Number(reversalVoucher.id)):[];
  const issues=[];
  if(originalTreasury.length!==1)issues.push(originalTreasury.length?"گردش خزانه تکراری":"گردش خزانه پیدا نشد");
  else if(originalTreasury[0].kind!=="PAYMENT"||Number(originalTreasury[0].amount)!==Number(payment.settlementRial)||Number(originalTreasury[0].foreignAmountMinor)!==Number(payment.amountMinor)||Number(originalTreasury[0].foreignPayableId)!==Number(payment.payableId))issues.push("مبلغ یا مشخصات گردش خزانه مغایر است");
  if(originalLedger.length!==1)issues.push(originalLedger.length?"گردش طرف حساب تکراری":"گردش طرف حساب پیدا نشد");
  else if(Number(originalLedger[0].partyId)!==Number(payment.supplierId)||Number(originalLedger[0].debitRial)!==Number(payment.bookedRial)||Number(originalLedger[0].creditRial||0)!==0)issues.push("گردش طرف حساب مغایر است");
  if(originalVouchers.length!==1)issues.push(originalVouchers.length?"سند حسابداری تکراری":"سند حسابداری پیدا نشد");
  else{
   const debit=lines.reduce((n,x)=>n+Number(x.debitRial||0),0),credit=lines.reduce((n,x)=>n+Number(x.creditRial||0),0);
   const liability=lines.filter(x=>String(x.accountCode)==="2101").reduce((n,x)=>n+Number(x.debitRial||0)-Number(x.creditRial||0),0);
   if(!lines.length||debit!==credit||liability!==Number(payment.bookedRial))issues.push("سند حسابداری نامتوازن یا بدهی آن مغایر است");
  }
  if(!active){
   if(originalTreasury.length===1&&originalTreasury[0].status!=="REVERSED")issues.push("گردش خزانه اصلی وضعیت برگشت ندارد");
   if(reversalTreasury.length!==1)issues.push(reversalTreasury.length?"گردش برگشت خزانه تکراری":"گردش برگشت خزانه پیدا نشد");
   else if(reversalTreasury[0].kind!=="RECEIPT"||Number(reversalTreasury[0].amount)!==Number(payment.settlementRial))issues.push("مبلغ گردش برگشت خزانه مغایر است");
   if(reversalLedger.length!==1)issues.push(reversalLedger.length?"گردش برگشت طرف حساب تکراری":"گردش برگشت طرف حساب پیدا نشد");
   else if(Number(reversalLedger[0].partyId)!==Number(payment.supplierId)||Number(reversalLedger[0].creditRial)!==Number(payment.bookedRial))issues.push("گردش برگشت طرف حساب مغایر است");
   if(reversalVouchers.length!==1)issues.push(reversalVouchers.length?"سند برگشت تکراری":"سند برگشت حسابداری پیدا نشد");
   else{const debit=reversalLines.reduce((n,x)=>n+Number(x.debitRial||0),0),credit=reversalLines.reduce((n,x)=>n+Number(x.creditRial||0),0);if(!reversalLines.length||debit!==credit)issues.push("سند برگشت نامتوازن است")}
  }else if(reversalTreasury.length||reversalLedger.length||reversalVouchers.length)issues.push("برای پرداخت فعال، سند برگشت غیرمنتظره وجود دارد");
  return {paymentId:payment.id,reference,sourceNumber:payment.sourceNumber,status:active?"فعال":"برگشت‌شده",ok:issues.length===0,issues};
 });
 return {total:rows.length,matched:rows.filter(x=>x.ok).length,withIssues:rows.filter(x=>!x.ok).length,rows};
}

function reconcileForeignPayableBalances(input){
 const payables=Array.isArray(input.payables)?input.payables:[],payments=Array.isArray(input.payments)?input.payments:[],partyLedger=Array.isArray(input.partyLedger)?input.partyLedger:[],vouchers=Array.isArray(input.vouchers)?input.vouchers:[],voucherLines=Array.isArray(input.voucherLines)?input.voucherLines:[];
 const groups=new Map();
 for(const payable of payables){
  if(!payable||payable.status==="CANCELLED"||!payable.shipmentReceivedAt)continue;
  const supplierId=Number(payable.supplierId);if(!Number.isSafeInteger(supplierId)||supplierId<=0)continue;
  let group=groups.get(supplierId);if(!group){group={supplierId,supplierName:String(payable.supplierName||"تأمین‌کننده "+supplierId),currencies:{},payables:[],references:new Set()};groups.set(supplierId,group)}
  const currency=String(payable.currency||"");if(!group.currencies[currency])group.currencies[currency]={outstandingMinor:0,bookValueRial:0,payableCount:0};
  const bucket=group.currencies[currency],remaining=Number(payable.amountMinor)-Number(payable.paidMinor||0),bookValue=Number(payable.bookedRial)-Number(payable.bookedRialPaid||0);
  if(!Number.isSafeInteger(remaining)||remaining<0||!Number.isSafeInteger(bookValue)||bookValue<0)throw new Error("مانده تعهد ارزی برای تطبیق معتبر نیست");
  bucket.outstandingMinor+=remaining;bucket.bookValueRial+=bookValue;bucket.payableCount++;
  const receiptReference="IMPORT-RECEIPT:"+String(payable.sourceNumber||"");
  const payablePayments=payments.filter(x=>Number(x.payableId)===Number(payable.id));
  group.payables.push({payableId:payable.id,sourceNumber:payable.sourceNumber,currency,remainingMinor:remaining,bookValueRial:bookValue});
  group.references.add(receiptReference);
  for(const payment of payablePayments){
   if(payment.reference)group.references.add(String(payment.reference));
   if(payment.status==="REVERSED")group.references.add("FXPAY-REV:"+payment.id);
  }
  group.trace=group.trace||[];
  group.trace.push({payableId:payable.id,sourceNumber:String(payable.sourceNumber||"—"),currency,remainingMinor:remaining,bookValueRial:bookValue,receiptReference,payments:payablePayments.map(payment=>({id:payment.id,reference:String(payment.reference||""),status:payment.status==="REVERSED"?"برگشت‌شده":"فعال",amountMinor:Number(payment.amountMinor||0),bookedRial:Number(payment.bookedRial||0),settlementRial:Number(payment.settlementRial||0),reversalReference:payment.status==="REVERSED"?"FXPAY-REV:"+payment.id:null}))});
 }
 const rows=[...groups.values()].map(group=>{
  const refs=group.references,ledgerRows=partyLedger.filter(x=>refs.has(String(x.referenceId||""))&&Number(x.partyId)===group.supplierId);
  const partyLedgerBalanceRial=ledgerRows.reduce((n,x)=>n+Number(x.creditRial||0)-Number(x.debitRial||0),0);
  const voucherIds=new Set(vouchers.filter(x=>refs.has(String(x.reference||""))).map(x=>Number(x.id)));
  const liabilityLines=voucherLines.filter(x=>voucherIds.has(Number(x.voucherId))&&String(x.accountCode)==="2101");
  const generalLedgerBalanceRial=liabilityLines.reduce((n,x)=>n+Number(x.creditRial||0)-Number(x.debitRial||0),0);
  const bookValueRial=Object.values(group.currencies).reduce((n,x)=>n+x.bookValueRial,0);
  const ledgerDeltaRial=partyLedgerBalanceRial-bookValueRial,generalLedgerDeltaRial=generalLedgerBalanceRial-bookValueRial,subledgerDeltaRial=partyLedgerBalanceRial-generalLedgerBalanceRial;
  const issues=[];if(ledgerDeltaRial!==0)issues.push("مانده تفصیلی با ارزش دفتری تعهدها برابر نیست");if(generalLedgerDeltaRial!==0)issues.push("حساب کل ۲۱۰۱ مرتبط با محموله‌ها با ارزش دفتری برابر نیست");if(subledgerDeltaRial!==0)issues.push("دفتر تفصیلی تأمین‌کننده با حساب کل مرتبط برابر نیست");
  const trace=group.trace.map(item=>{const refsFor=[item.receiptReference,...item.payments.flatMap(p=>[p.reference,p.reversalReference].filter(Boolean))];const relatedVouchers=vouchers.filter(v=>refsFor.includes(String(v.reference||"")));return {...item,partyLedgerRows:partyLedger.filter(x=>refsFor.includes(String(x.referenceId||""))&&Number(x.partyId)===group.supplierId).length,vouchers:relatedVouchers.map(v=>({number:String(v.number||v.voucherNumber||v.id),reference:String(v.reference||""),id:v.id,lines:voucherLines.filter(line=>Number(line.voucherId)===Number(v.id)).length}))}});return {supplierId:group.supplierId,supplierName:group.supplierName,currencies:group.currencies,payableCount:group.payables.length,payables:group.payables,trace,bookValueRial,partyLedgerBalanceRial,generalLedgerBalanceRial,ledgerDeltaRial,generalLedgerDeltaRial,subledgerDeltaRial,ok:issues.length===0,issues,referenceCount:refs.size,references:[...refs]};
 });
 return {total:rows.length,matched:rows.filter(x=>x.ok).length,withIssues:rows.filter(x=>!x.ok).length,rows};
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

function filterForeignPayableBalanceRows(input){
 const rows=Array.isArray(input.rows)?input.rows:[];
 const supplierId=input.supplierId==null?"":String(input.supplierId),currency=input.currency==null?"":String(input.currency),status=input.status==null?"":String(input.status);
 return rows.filter(row=>{
  if(supplierId&&String(row.supplierId)!==supplierId)return false;
  if(status==="MATCHED"&&!row.ok)return false;
  if(status==="ISSUES"&&row.ok)return false;
  if(currency&&!Object.prototype.hasOwnProperty.call(row.currencies||{},currency))return false;
  return true;
 });
}
function buildForeignPayableBalanceCsv(input){
 const rows=filterForeignPayableBalanceRows(input),cells=[
  ["تأمین‌کننده","شناسه تأمین‌کننده","ارز","مانده ارزی","ارزش دفتری ریالی","مانده تفصیلی ریالی","مانده کل ۲۱۰۱ ریالی","اختلاف تفصیلی","اختلاف کل","وضعیت","شماره محموله","مراجع ردیابی"]
 ];
 for(const row of rows){
  const trace=Array.isArray(row.trace)?row.trace:[];
  const currencies=Object.entries(row.currencies||{});
  for(const [currency,balance] of currencies){
   const shipments=trace.filter(x=>x.currency===currency);
   cells.push([row.supplierName,row.supplierId,currency,Number(balance.outstandingMinor||0)/100,Number(balance.bookValueRial||0),Number(row.partyLedgerBalanceRial||0),Number(row.generalLedgerBalanceRial||0),Number(row.ledgerDeltaRial||0),Number(row.generalLedgerDeltaRial||0),row.ok?"منطبق":"دارای مغایرت",shipments.map(x=>x.sourceNumber).join("؛ "),shipments.flatMap(x=>[x.receiptReference,...(x.payments||[]).flatMap(p=>[p.reference,p.reversalReference].filter(Boolean))]).filter(Boolean).join("؛ ")]);
  }
 }
 const quote=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
 return "\uFEFF"+cells.map(row=>row.map(quote).join(",")).join("\r\n");
}
const ForeignPayables={createForeignPayable,planForeignPayablePayment,planForeignPayableReversal,planForeignPayableInstallment,allocateForeignPayablePaymentToInstallments,getRemainingForeignPayableInstallments,clearForeignPayableInstallmentPlan,summarizeForeignPayable,summarizeForeignPayablesForecast,reconcileForeignPayablePayments,reconcileForeignPayableBalances,filterForeignPayableBalanceRows,buildForeignPayableBalanceCsv};
if(typeof module!=="undefined")module.exports=ForeignPayables;
if(typeof globalThis!=="undefined")globalThis.HolooForeignPayables=ForeignPayables;
