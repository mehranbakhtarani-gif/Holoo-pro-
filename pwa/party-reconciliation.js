"use strict";
function safeRial(value){
 const number=Number(value??0);
 return Number.isSafeInteger(number)?number:null;
}
function safeNumber(value){
 return value<=BigInt(Number.MAX_SAFE_INTEGER)&&value>=BigInt(Number.MIN_SAFE_INTEGER)?Number(value):null;
}
function reconcilePartyBalances(input){
 const data=input||{},parties=Array.isArray(data.parties)?data.parties:[],ledger=Array.isArray(data.partyLedger)?data.partyLedger:[],accounts=Array.isArray(data.accounts)?data.accounts:[],vouchers=Array.isArray(data.vouchers)?data.vouchers:[],voucherLines=Array.isArray(data.voucherLines)?data.voucherLines:[];
 const knownPartyIds=new Set(parties.map(party=>Number(party?.id)).filter(id=>Number.isSafeInteger(id)&&id>0));
 const ledgerByParty=new Map(),orphanLedgerRows=[],invalidLedgerRows=[];
 let ledgerTotal=0n;
 for(const row of ledger){
  const partyId=Number(row?.partyId),debit=safeRial(row?.debitRial),credit=safeRial(row?.creditRial);
  if(debit===null||credit===null||debit<0||credit<0||(debit>0&&credit>0)){
   invalidLedgerRows.push({partyId:Number.isSafeInteger(partyId)?partyId:null,referenceId:String(row?.referenceId||""),reason:"مبلغ بدهکار/بستانکار نامعتبر است"});
   continue;
  }
  const delta=BigInt(debit)-BigInt(credit);ledgerTotal+=delta;
  if(!Number.isSafeInteger(partyId)||partyId<=0||!knownPartyIds.has(partyId)){orphanLedgerRows.push({partyId:Number.isSafeInteger(partyId)?partyId:null,referenceId:String(row?.referenceId||"")});continue}
  ledgerByParty.set(partyId,(ledgerByParty.get(partyId)||0n)+delta);
 }
 const rows=parties.map(party=>{
  const partyId=Number(party?.id),stored=safeRial(party?.balance),subledger=ledgerByParty.get(partyId)||0n,issues=[];
  if(!Number.isSafeInteger(partyId)||partyId<=0)issues.push("شناسه طرف حساب نامعتبر است");
  if(stored===null)issues.push("مانده ثبت‌شده عدد صحیح امن نیست");
  const ledgerBalance=safeNumber(subledger);
  if(ledgerBalance===null)issues.push("جمع دفتر تفصیلی از محدوده عددی امن خارج است");
  const delta=stored===null||ledgerBalance===null?null:stored-ledgerBalance;
  if(delta!==null&&delta!==0)issues.push("مانده طرف حساب با جمع دفتر تفصیلی برابر نیست");
  return {partyId:Number.isSafeInteger(partyId)?partyId:null,partyName:String(party?.name||"طرف حساب"),storedBalanceRial:stored,partyLedgerBalanceRial:safeNumber(subledger),deltaRial:delta,ledgerRows:ledger.filter(row=>Number(row?.partyId)===partyId).length,ok:issues.length===0,issues};
 });
 for(const row of invalidLedgerRows)rows.push({partyId:row.partyId,partyName:"گردش تفصیلی نامعتبر",storedBalanceRial:null,partyLedgerBalanceRial:null,deltaRial:null,ledgerRows:1,ok:false,issues:[row.reason+"؛ مرجع "+(row.referenceId||"—")]});
 for(const row of orphanLedgerRows)rows.push({partyId:null,partyName:"گردش بدون طرف حساب",storedBalanceRial:null,partyLedgerBalanceRial:null,deltaRial:null,ledgerRows:1,ok:false,issues:["گردش تفصیلی به طرف حساب موجود متصل نیست؛ مرجع "+(row.referenceId||"—")]});
 const byVoucherId=new Map(vouchers.map(voucher=>[Number(voucher.id),voucher]));
 const openingByAccount=new Map(),movementByAccount=new Map([["1103",0n],["2101",0n]]);
 for(const account of accounts){
  const code=String(account?.id||"");
  if(code!=="1103"&&code!=="2101")continue;
  const debit=safeRial(account?.openingDebitRial),credit=safeRial(account?.openingCreditRial);
  if(debit===null||credit===null||debit<0||credit<0)throw new Error("مانده افتتاحیه حساب کنترلی "+code+" معتبر نیست");
  openingByAccount.set(code,BigInt(debit)-BigInt(credit));
 }
 for(const line of voucherLines){
  const code=String(line?.accountCode||"");if(!movementByAccount.has(code))continue;
  const debit=safeRial(line?.debitRial),credit=safeRial(line?.creditRial);
  if(debit===null||credit===null||debit<0||credit<0||(debit>0&&credit>0))throw new Error("گردش حساب کنترلی "+code+" دارای مبلغ نامعتبر است");
  if(!byVoucherId.has(Number(line?.voucherId)))continue;
  movementByAccount.set(code,movementByAccount.get(code)+BigInt(debit)-BigInt(credit));
 }
 const accountBalances={};
 for(const code of ["1103","2101"]){
  const opening=openingByAccount.get(code)||0n,movement=movementByAccount.get(code)||0n;
  accountBalances[code]={openingBalanceRial:safeNumber(opening),voucherMovementRial:safeNumber(movement),balanceRial:safeNumber(opening+movement)};
 }
 const partyBalanceTotal=parties.reduce((sum,party)=>{const value=safeRial(party?.balance);return value===null?sum:sum+BigInt(value)},0n);
 const controlBalance=BigInt(accountBalances["1103"].balanceRial??0)+BigInt(accountBalances["2101"].balanceRial??0);
 const totals={
  partyBalanceRial:safeNumber(partyBalanceTotal),
  partyLedgerBalanceRial:safeNumber(ledgerTotal),
  controlAccountBalanceRial:safeNumber(controlBalance),
  partyVsLedgerDeltaRial:safeNumber(partyBalanceTotal-ledgerTotal),
  controlVsLedgerDeltaRial:safeNumber(controlBalance-ledgerTotal),
  partyVsControlDeltaRial:safeNumber(partyBalanceTotal-controlBalance)
 };
 const globalIssues=[];
 if(totals.partyBalanceRial===null||totals.partyLedgerBalanceRial===null||totals.controlAccountBalanceRial===null)globalIssues.push("جمع یکی از مانده‌ها از محدوده عددی امن خارج است");
 if(totals.partyVsLedgerDeltaRial!==null&&totals.partyVsLedgerDeltaRial!==0)globalIssues.push("جمع مانده اشخاص با جمع دفتر تفصیلی برابر نیست");
 if(totals.controlVsLedgerDeltaRial!==null&&totals.controlVsLedgerDeltaRial!==0)globalIssues.push("جمع حساب‌های کنترلی ۱۱۰۳ و ۲۱۰۱ با دفتر تفصیلی برابر نیست");
 return {total:parties.length,matched:rows.filter(row=>row.ok).length,withIssues:rows.filter(row=>!row.ok).length,rows,accountBalances,totals,orphanLedgerRows:orphanLedgerRows.length,invalidLedgerRows:invalidLedgerRows.length,globalIssues,ok:rows.every(row=>row.ok)&&globalIssues.length===0};
}
const PartyReconciliation={reconcilePartyBalances};
if(typeof module!=="undefined"&&module.exports)module.exports=PartyReconciliation;
if(typeof globalThis!=="undefined")globalThis.HolooPartyReconciliation=PartyReconciliation;
