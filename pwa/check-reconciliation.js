"use strict";
function safeAmount(value){const amount=Number(value);return Number.isSafeInteger(amount)&&amount>0?amount:null}
function sumByAccount(lines){
 const totals=new Map();
 for(const line of lines||[]){
  const account=String(line?.accountCode||""),debit=Number(line?.debitRial??0),credit=Number(line?.creditRial??0);
  if(!account||!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit)||debit<0||credit<0||(debit>0&&credit>0))return null;
  const current=totals.get(account)||{debit:0,credit:0};
  current.debit+=debit;current.credit+=credit;
  if(!Number.isSafeInteger(current.debit)||!Number.isSafeInteger(current.credit))return null;
  totals.set(account,current);
 }
 return totals;
}
function sameAccountTotals(left,right){
 if(!left||!right||left.size!==right.size)return false;
 for(const [account,value] of left){const other=right.get(account);if(!other||value.debit!==other.credit||value.credit!==other.debit)return false}
 return true;
}
function validateClearedCheckForReversal({check,treasury,voucherLines,partyLedgerRows}={}){
 const issues=[],amount=safeAmount(check?.amount),received=check?.kind==="RECEIVED",expectedKind=received?"RECEIPT":"PAYMENT",reference="CHECK:CLEAR:"+check?.id;
 if(!amount)issues.push("مبلغ چک معتبر نیست");
 if(!check||!["RECEIVED","PAYABLE"].includes(check.kind))issues.push("نوع چک معتبر نیست");
 if(!treasury||treasury.reference!==reference||Number(treasury.checkId)!==Number(check?.id)||treasury.kind!==expectedKind||Number(treasury.amount)!==amount||Number(treasury.partyId)!==Number(check?.partyId)||treasury.status==="REVERSED")issues.push("گردش خزانه اصلی با چک مطابقت ندارد");
 const expected=received?new Map([["1102",{debit:amount,credit:0}],["1103",{debit:0,credit:amount}]]):new Map([["2101",{debit:amount,credit:0}],["1102",{debit:0,credit:amount}]]);
 const actual=sumByAccount(voucherLines);
 if(!actual||actual.size!==2||[...expected].some(([code,value])=>{const got=actual.get(code);return !got||got.debit!==value.debit||got.credit!==value.credit}))issues.push("حساب‌های سند اصلی چک یا مبالغ آن نادرست است");
 const ledger=Array.isArray(partyLedgerRows)?partyLedgerRows:[];
 const expectedDebit=received?0:amount,expectedCredit=received?amount:0;
 if(ledger.length!==1||Number(ledger[0]?.partyId)!==Number(check?.partyId)||Number(ledger[0]?.debitRial)!==expectedDebit||Number(ledger[0]?.creditRial)!==expectedCredit||ledger[0]?.referenceId!==reference)issues.push("گردش دفتر تفصیلی اصلی چک با نوع و مبلغ آن مطابقت ندارد");
 return {ok:issues.length===0,issues,amount,expectedKind,reference,expectedVoucherLines:expected};
}
function validateEndorsedCheckForReversal({check,sourceParty,targetParty,voucherLines,partyLedgerRows}={}){
 const issues=[],amount=safeAmount(check?.amount),reference="CHECK:ENDORSE:"+check?.id;
 if(!check||check.kind!=="RECEIVED"||check.status!=="ENDORSED")issues.push("فقط چک دریافتی ظهرنویسی‌شده قابل برگشت است");
 if(!amount)issues.push("مبلغ چک معتبر نیست");
 if(!sourceParty||Number(sourceParty.id)!==Number(check?.partyId)||sourceParty.kind==="SUPPLIER")issues.push("صادرکننده چک یا مشتری اصلی معتبر نیست");
 if(!targetParty||Number(targetParty.id)!==Number(check?.endorseToPartyId)||targetParty.kind==="CUSTOMER"||Number(targetParty.id)===Number(sourceParty?.id))issues.push("ذی‌نفع ظهرنویسی معتبر نیست");
 const actual=sumByAccount(voucherLines);
 if(!actual||actual.size!==2||actual.get("2101")?.debit!==amount||actual.get("2101")?.credit!==0||actual.get("1103")?.debit!==0||actual.get("1103")?.credit!==amount)issues.push("حساب‌های سند ظهرنویسی یا مبالغ آن نادرست است");
 const rows=Array.isArray(partyLedgerRows)?partyLedgerRows:[];
 const source=rows.filter(row=>Number(row?.partyId)===Number(check?.partyId)),target=rows.filter(row=>Number(row?.partyId)===Number(check?.endorseToPartyId));
 if(rows.length!==2||source.length!==1||target.length!==1||Number(source[0]?.debitRial)!==0||Number(source[0]?.creditRial)!==amount||source[0]?.referenceId!==reference||Number(target[0]?.debitRial)!==amount||Number(target[0]?.creditRial)!==0||target[0]?.referenceId!==reference)issues.push("گردش دفتر تفصیلی دو طرف ظهرنویسی با سند مطابقت ندارد");
 return {ok:issues.length===0,issues,amount,reference,expectedVoucherLines:new Map([["2101",{debit:amount,credit:0}],["1103",{debit:0,credit:amount}]])};
}
function validateExactVoucherInverse(originalLines,reversalLines){
 return sameAccountTotals(sumByAccount(originalLines),sumByAccount(reversalLines));
}
const CheckReconciliation={validateClearedCheckForReversal,validateEndorsedCheckForReversal,validateExactVoucherInverse};
if(typeof module!=="undefined"&&module.exports)module.exports=CheckReconciliation;
if(typeof globalThis!=="undefined")globalThis.HolooCheckReconciliation=CheckReconciliation;
