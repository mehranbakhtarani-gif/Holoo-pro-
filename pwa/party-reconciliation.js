"use strict";
function safeRial(value,label){
 const n=Number(value);
 if(!Number.isSafeInteger(n))throw new Error(label+" باید عدد صحیح ریالی باشد");
 return n;
}
function reconcilePartyBalances(input){
 const parties=Array.isArray(input.parties)?input.parties:[],partyLedger=Array.isArray(input.partyLedger)?input.partyLedger:[],treasury=Array.isArray(input.treasury)?input.treasury:[],payables=Array.isArray(input.importChargePayables)?input.importChargePayables:[],foreignPayables=Array.isArray(input.foreignPayables)?input.foreignPayables:[],foreignPayments=Array.isArray(input.foreignPayments)?input.foreignPayments:[];
 const knownPartyIds=new Set(parties.map(x=>Number(x.id)));
 const orphanLedgerRows=partyLedger.filter(x=>!knownPartyIds.has(Number(x.partyId)));
 const orphanImportPayables=payables.filter(x=>x.status!=="RECONCILIATION_REQUIRED"&&x.status!=="CANCELLED"&&(!x.partyId?(x.status!=="OPEN"||Number(x.paidRial||0)>0):!knownPartyIds.has(Number(x.partyId))));
 const orphanForeignPayables=foreignPayables.filter(x=>x.status!=="CANCELLED"&&x.shipmentReceivedAt&&(!x.supplierId||!knownPartyIds.has(Number(x.supplierId))));
 const orphanForeignPayments=foreignPayments.filter(x=>!foreignPayables.some(p=>Number(p.id)===Number(x.payableId)));
 const rows=parties.map(party=>{
  const issues=[],add=message=>{if(!issues.includes(message))issues.push(message)},partyId=Number(party.id);
  let partyBalance=0,ledgerBalance=0,ancillaryOutstandingRial=0,ancillaryLedgerBalanceRial=0,foreignPayableOutstandingRial=0,foreignPayableLedgerBalanceRial=0;
  try{partyBalance=safeRial(party.balance||0,"مانده طرف حساب")}catch(e){add(e.message)}
  const movements=partyLedger.filter(x=>Number(x.partyId)===partyId);
  for(const movement of movements){
   let debit,credit;
   try{debit=safeRial(movement.debitRial||0,"بدهکار تفصیلی");credit=safeRial(movement.creditRial||0,"بستانکار تفصیلی")}catch(e){add(e.message);continue}
   if(debit<0||credit<0||(debit>0)===(credit>0))add("یکی از ردیف‌های تفصیلی باید فقط یک سمت مبلغ داشته باشد");
   ledgerBalance+=debit-credit;if(!Number.isSafeInteger(ledgerBalance))add("جمع گردش تفصیلی از محدوده عددی مجاز خارج است");
  }
  const difference=partyBalance-ledgerBalance;
  if(!Number.isSafeInteger(difference)||difference!==0)add("مانده ثبت‌شده شخص با جمع گردش تفصیلی برابر نیست");
  const openingRows=movements.filter(x=>x.referenceId==="OPENING:PARTY:"+partyId);
  if(openingRows.length>1)add("سند تفصیلی مانده افتتاحیه تکراری است");
  const assigned=payables.filter(x=>Number(x.partyId)===partyId&&x.status!=="RECONCILIATION_REQUIRED"&&x.status!=="CANCELLED");
  for(const payable of assigned){
   const total=Number(payable.amountRial),paid=Number(payable.paidRial||0),outstanding=total-paid;
   if(!Number.isSafeInteger(total)||total<=0||!Number.isSafeInteger(paid)||paid<0||paid>total){add("مبلغ یا پرداختی یکی از هزینه‌های جانبی نامعتبر است");continue}
   ancillaryOutstandingRial+=outstanding;if(!Number.isSafeInteger(ancillaryOutstandingRial)){add("جمع پرداختنی‌های جانبی از محدوده عددی مجاز خارج است");continue}
   const accrualReference="IMPORT-CHARGE-ACCRUAL:"+payable.id,accrualRows=partyLedger.filter(x=>x.referenceId===accrualReference);
   if(accrualRows.length!==1||Number(accrualRows[0]?.partyId)!==partyId||Number(accrualRows[0]?.debitRial||0)!==0||Number(accrualRows[0]?.creditRial)!==total)add("سند ایجاد بدهی هزینه جانبی با مبلغ یا طلبکار پرداختنی تطبیق ندارد");
   const payments=treasury.filter(x=>Number(x.importChargePayableId)===Number(payable.id)),refs=[accrualReference];
   let paidFromTreasury=0;
   for(const payment of payments){
    const reference=String(payment.reference||"");if(!reference){add("مرجع یکی از پرداخت‌های هزینه جانبی خالی است");continue}
    refs.push(reference);
    if(payment.status!=="REVERSED"){paidFromTreasury+=Number(payment.amount||0);if(!Number.isSafeInteger(paidFromTreasury))add("جمع پرداخت‌های هزینه جانبی از محدوده عددی مجاز خارج است")}
    const originalRows=partyLedger.filter(x=>x.referenceId===reference);
    if(originalRows.length!==1||Number(originalRows[0]?.partyId)!==partyId||Number(originalRows[0]?.debitRial||0)!==Number(payment.amount)||Number(originalRows[0]?.creditRial||0)!==0)add("گردش تفصیلی یکی از پرداخت‌های هزینه جانبی با خزانه تطبیق ندارد");
    const reversals=treasury.filter(x=>Number(x.reversalOfId)===Number(payment.id)||x.reversalOf===reference);
    if(payment.status==="REVERSED"){
     if(reversals.length!==1)add("برگشت پرداخت هزینه جانبی یکتا نیست");
     else{
      const reversal=reversals[0],reversalRows=partyLedger.filter(x=>x.referenceId===reversal.reference);
      refs.push(String(reversal.reference||""));
      if(reversalRows.length!==1||Number(reversalRows[0]?.partyId)!==partyId||Number(reversalRows[0]?.debitRial||0)!==0||Number(reversalRows[0]?.creditRial||0)!==Number(payment.amount))add("گردش تفصیلی برگشت پرداخت هزینه جانبی با مبلغ آن مطابقت ندارد");
     }
    }else if(reversals.length)add("برای پرداخت فعال هزینه جانبی، برگشت غیرمنتظره ثبت شده است");
   }
   if(paidFromTreasury!==paid)add("جمع پرداخت‌های خزانه با مبلغ پرداخت‌شده پرداختنی جانبی برابر نیست");
   const relatedRows=partyLedger.filter(x=>refs.includes(String(x.referenceId||""))&&Number(x.partyId)===partyId);
   let relatedNet=0;for(const row of relatedRows){relatedNet+=Number(row.debitRial||0)-Number(row.creditRial||0);if(!Number.isSafeInteger(relatedNet))add("جمع تفصیلی هزینه جانبی از محدوده عددی مجاز خارج است")}
   ancillaryLedgerBalanceRial+=relatedNet;if(!Number.isSafeInteger(ancillaryLedgerBalanceRial))add("جمع گردش هزینه‌های جانبی از محدوده عددی مجاز خارج است");
   if(relatedNet!==-outstanding)add("مانده پرداختنی‌های جانبی با گردش تفصیلی همان هزینه‌ها برابر نیست");
  }
  const assignedForeign=foreignPayables.filter(x=>Number(x.supplierId)===partyId&&x.status!=="CANCELLED"&&x.shipmentReceivedAt);
  for(const payable of assignedForeign){
   let amountMinor,paidMinor,bookedRial,bookedRialPaid;
   try{amountMinor=safeRial(payable.amountMinor,"کل تعهد ارزی");paidMinor=safeRial(payable.paidMinor||0,"پرداخت ارزی");bookedRial=safeRial(payable.bookedRial,"ارزش دفتری تعهد");bookedRialPaid=safeRial(payable.bookedRialPaid||0,"ارزش دفتری پرداخت‌شده")}catch(e){add(e.message);continue}
   if(amountMinor<=0||paidMinor>amountMinor||bookedRial<=0||bookedRialPaid>bookedRial){add("مانده یا ارزش دفتری تعهد ارزی معتبر نیست");continue}
   const outstanding=bookedRial-bookedRialPaid;foreignPayableOutstandingRial+=outstanding;
   if(!Number.isSafeInteger(foreignPayableOutstandingRial))add("جمع تعهدات ارزی ریالی از محدوده عددی مجاز خارج است");
   const receiptReference="IMPORT-RECEIPT:"+String(payable.sourceNumber||""),receiptRows=partyLedger.filter(x=>x.referenceId===receiptReference);
   if(receiptRows.length!==1||Number(receiptRows[0]?.partyId)!==partyId||Number(receiptRows[0]?.debitRial||0)!==0||Number(receiptRows[0]?.creditRial)!==bookedRial)add("گردش بدهی رسید محموله با ارزش دفتری تعهد ارزی مطابقت ندارد");
   const payments=foreignPayments.filter(x=>Number(x.payableId)===Number(payable.id)),active=payments.filter(x=>x.status!=="REVERSED");
   const paidMinorFromPayments=active.reduce((n,x)=>n+Number(x.amountMinor||0),0),bookedFromPayments=active.reduce((n,x)=>n+Number(x.bookedRial||0),0);
   if(!Number.isSafeInteger(paidMinorFromPayments)||paidMinorFromPayments!==paidMinor||!Number.isSafeInteger(bookedFromPayments)||bookedFromPayments!==bookedRialPaid)add("جمع اقساط فعال با مانده پرداخت‌شده تعهد ارزی برابر نیست");
   const relatedRefs=[receiptReference];
   for(const payment of payments){
    const reference=String(payment.reference||"");if(!reference){add("مرجع یکی از پرداخت‌های ارزی خالی است");continue}
    relatedRefs.push(reference);
    const originalRows=partyLedger.filter(x=>x.referenceId===reference);
    if(originalRows.length!==1||Number(originalRows[0]?.partyId)!==partyId||Number(originalRows[0]?.debitRial||0)!==Number(payment.bookedRial)||Number(originalRows[0]?.creditRial||0)!==0)add("گردش تفصیلی پرداخت ارزی با ارزش دفتری آن مطابقت ندارد");
    const treasuryRows=treasury.filter(x=>x.reference===reference);
    if(treasuryRows.length!==1||treasuryRows[0]?.kind!=="PAYMENT"||Number(treasuryRows[0]?.partyId)!==partyId||Number(treasuryRows[0]?.amount)!==Number(payment.settlementRial)||Number(treasuryRows[0]?.foreignAmountMinor)!==Number(payment.amountMinor)||Number(treasuryRows[0]?.foreignPayableId)!==Number(payable.id))add("گردش خزانه پرداخت ارزی با تعهد و قسط مطابقت ندارد");
    const reversalReference="FXPAY-REV:"+payment.id,reversalRows=partyLedger.filter(x=>x.referenceId===reversalReference),reversalTreasury=treasury.filter(x=>x.reference===reversalReference);
    if(payment.status==="REVERSED"){
     relatedRefs.push(reversalReference);
     if(reversalRows.length!==1||Number(reversalRows[0]?.partyId)!==partyId||Number(reversalRows[0]?.debitRial||0)!==0||Number(reversalRows[0]?.creditRial)!==Number(payment.bookedRial))add("گردش تفصیلی برگشت پرداخت ارزی با ارزش دفتری قسط مطابقت ندارد");
     if(reversalTreasury.length!==1||reversalTreasury[0]?.kind!=="RECEIPT"||Number(reversalTreasury[0]?.amount)!==Number(payment.settlementRial)||reversalTreasury[0]?.reversalOf!==reference)add("گردش خزانه برگشت پرداخت ارزی معتبر نیست");
    }else if(reversalRows.length||reversalTreasury.length)add("برای پرداخت ارزی فعال، گردش برگشت غیرمنتظره وجود دارد");
   }
   const relatedRows=partyLedger.filter(x=>relatedRefs.includes(String(x.referenceId||""))&&Number(x.partyId)===partyId);
   let relatedNet=0;for(const row of relatedRows){relatedNet+=Number(row.debitRial||0)-Number(row.creditRial||0);if(!Number.isSafeInteger(relatedNet))add("جمع گردش تفصیلی تعهد ارزی از محدوده عددی مجاز خارج است")}
   foreignPayableLedgerBalanceRial+=relatedNet;if(!Number.isSafeInteger(foreignPayableLedgerBalanceRial))add("جمع گردش تفصیلی تعهدات ارزی از محدوده عددی مجاز خارج است");
   if(relatedNet!==-outstanding)add("مانده تعهد ارزی با گردش تفصیلی همان محموله برابر نیست");
  }
  return {partyId,partyName:String(party.name||""),partyKind:String(party.kind||""),partyBalance,ledgerBalance,difference,openingMovementCount:openingRows.length,ancillaryPayableCount:assigned.length,ancillaryOutstandingRial,ancillaryLedgerBalanceRial,foreignPayableCount:assignedForeign.length,foreignPayableOutstandingRial,foreignPayableLedgerBalanceRial,ok:issues.length===0,issues};
 });
 const orphanPayableCount=orphanImportPayables.length+orphanForeignPayables.length+orphanForeignPayments.length;
 const orphanIssues=[];
 if(orphanLedgerRows.length)orphanIssues.push(orphanLedgerRows.length+" ردیف گردش تفصیلی به شخص موجود متصل نیست");
 if(orphanImportPayables.length)orphanIssues.push(orphanImportPayables.length+" پرداختنی جانبی به شخص معتبر متصل نیست");
 if(orphanForeignPayables.length)orphanIssues.push(orphanForeignPayables.length+" تعهد ارزی به تأمین‌کننده معتبر متصل نیست");
 if(orphanForeignPayments.length)orphanIssues.push(orphanForeignPayments.length+" پرداخت ارزی به تعهد موجود متصل نیست");
 return {total:rows.length,matched:rows.filter(x=>x.ok).length,withIssues:rows.filter(x=>!x.ok).length+(orphanIssues.length?1:0),rows,orphanLedgerRows,orphanPayableCount,orphanIssues};
}
const PartyReconciliation={reconcilePartyBalances};
if(typeof module!=="undefined"&&module.exports)module.exports=PartyReconciliation;
if(typeof globalThis!=="undefined")globalThis.HolooPartyReconciliation=PartyReconciliation;
