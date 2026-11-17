"use strict";
function safeRial(value,label){
 const n=Number(value);
 if(!Number.isSafeInteger(n))throw new Error(label+" باید عدد صحیح ریالی باشد");
 return n;
}
function reconcilePartyBalances(input){
 const parties=Array.isArray(input.parties)?input.parties:[],partyLedger=Array.isArray(input.partyLedger)?input.partyLedger:[],treasury=Array.isArray(input.treasury)?input.treasury:[],payables=Array.isArray(input.importChargePayables)?input.importChargePayables:[];
 const rows=parties.map(party=>{
  const issues=[],add=message=>{if(!issues.includes(message))issues.push(message)},partyId=Number(party.id);
  let partyBalance=0,ledgerBalance=0,ancillaryOutstandingRial=0,ancillaryLedgerBalanceRial=0;
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
   const payments=treasury.filter(x=>Number(x.importChargePayableId)===Number(payable.id));
   const refs=[accrualReference,...payments.map(x=>String(x.reference||""))];
   for(const payment of payments){
    const originalRows=partyLedger.filter(x=>x.referenceId===payment.reference);
    if(originalRows.length!==1||Number(originalRows[0]?.partyId)!==partyId||Number(originalRows[0]?.debitRial||0)!==Number(payment.amount)||Number(originalRows[0]?.creditRial||0)!==0)add("گردش تفصیلی یکی از پرداخت‌های هزینه جانبی با خزانه تطبیق ندارد");
    if(payment.status==="REVERSED"){
     const reversals=treasury.filter(x=>Number(x.reversalOfId)===Number(payment.id)||x.reversalOf===payment.reference);
     if(reversals.length!==1)add("برگشت پرداخت هزینه جانبی یکتا نیست");
     else refs.push(String(reversals[0].reference||""));
    }else if(treasury.some(x=>Number(x.reversalOfId)===Number(payment.id)||x.reversalOf===payment.reference))add("برای پرداخت فعال هزینه جانبی، برگشت غیرمنتظره ثبت شده است");
   }
   const relatedRows=partyLedger.filter(x=>refs.includes(String(x.referenceId||""))&&Number(x.partyId)===partyId);
   let relatedNet=0;for(const row of relatedRows){relatedNet+=Number(row.debitRial||0)-Number(row.creditRial||0);if(!Number.isSafeInteger(relatedNet))add("جمع تفصیلی هزینه جانبی از محدوده عددی مجاز خارج است")}
   ancillaryLedgerBalanceRial+=relatedNet;if(!Number.isSafeInteger(ancillaryLedgerBalanceRial))add("جمع گردش هزینه‌های جانبی از محدوده عددی مجاز خارج است");
   if(relatedNet!==-outstanding)add("مانده پرداختنی‌های جانبی با گردش تفصیلی همان هزینه‌ها برابر نیست");
  }
  return {partyId,partyName:String(party.name||""),partyKind:String(party.kind||""),partyBalance,ledgerBalance,difference,openingMovementCount:openingRows.length,ancillaryPayableCount:assigned.length,ancillaryOutstandingRial,ancillaryLedgerBalanceRial,ok:issues.length===0,issues};
 });
 return {total:rows.length,matched:rows.filter(x=>x.ok).length,withIssues:rows.filter(x=>!x.ok).length,rows};
}
const PartyReconciliation={reconcilePartyBalances};
if(typeof module!=="undefined"&&module.exports)module.exports=PartyReconciliation;
if(typeof globalThis!=="undefined")globalThis.HolooPartyReconciliation=PartyReconciliation;
