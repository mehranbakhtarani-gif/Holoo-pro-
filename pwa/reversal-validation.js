"use strict";

function normalizeReversalLine(line, label) {
 if(!line || typeof line!=="object")throw new Error("یکی از ردیف‌های سند "+label+" معتبر نیست");
 const accountCode=String(line.accountCode??"").trim();
 const debitRial=line.debitRial==null?0:Number(line.debitRial);
 const creditRial=line.creditRial==null?0:Number(line.creditRial);
 if(!accountCode)throw new Error("کد حساب یکی از ردیف‌های سند "+label+" خالی است");
 if(!Number.isSafeInteger(debitRial)||debitRial<0||!Number.isSafeInteger(creditRial)||creditRial<0||((debitRial>0)===(creditRial>0))) {
  throw new Error("مبلغ یا ماهیت یکی از ردیف‌های سند "+label+" معتبر نیست");
 }
 return {accountCode,debitRial,creditRial};
}

function sameLine(a,b) {
 return a.accountCode===b.accountCode&&a.debitRial===b.debitRial&&a.creditRial===b.creditRial;
}

function validateReversalVoucherPair({originalLines,reversalLines,additionalLines=[],label="سند"}) {
 if(!Array.isArray(originalLines)||originalLines.length<2)throw new Error("ردیف‌های سند اصلی "+label+" ناقص است");
 if(!Array.isArray(reversalLines)||!Array.isArray(additionalLines))throw new Error("ردیف‌های سند معکوس "+label+" معتبر نیست");
 if(reversalLines.length!==originalLines.length+additionalLines.length)throw new Error("تعداد ردیف‌های سند معکوس "+label+" با سند اصلی و تعدیلات مجاز برابر نیست");
 const original=originalLines.map(line=>normalizeReversalLine(line,"اصلی "+label));
 const reversal=reversalLines.map(line=>normalizeReversalLine(line,"معکوس "+label));
 for(let index=0;index<original.length;index++){
  const expected={accountCode:original[index].accountCode,debitRial:original[index].creditRial,creditRial:original[index].debitRial};
  if(!sameLine(reversal[index],expected))throw new Error("ردیف شماره "+(index+1)+" سند معکوس "+label+" دقیقاً معکوس ردیف متناظر سند اصلی نیست");
 }
 for(let index=0;index<additionalLines.length;index++){
  const expected=normalizeReversalLine(additionalLines[index],"تعدیل مجاز "+label);
  if(!sameLine(reversal[original.length+index],expected))throw new Error("ردیف تعدیلی اضافه در سند معکوس "+label+" با تعدیل مجاز مطابقت ندارد");
 }
 let debit=0,credit=0;
 for(const line of reversal){
  debit+=line.debitRial;credit+=line.creditRial;
  if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit))throw new Error("جمع سند معکوس "+label+" از محدوده عددی مجاز خارج است");
 }
 if(debit<=0||debit!==credit)throw new Error("سند معکوس "+label+" تراز یا معتبر نیست");
 return true;
}

function validateReversalVoucherLines({voucher,lines,accounts,expectedLines=null,expectedTotal=null,label="سند"}) {
 const voucherId=Number(voucher?.id);
 if(!voucher||!Number.isSafeInteger(voucherId)||voucherId<=0)throw new Error("سند اصلی "+label+" معتبر نیست");
 if(!Array.isArray(lines)||lines.length<2)throw new Error("ردیف‌های سند اصلی "+label+" ناقص است");
 const accountCodes=new Set((accounts||[]).map(account=>String(account.id)));
 const seenLineIds=new Set();
 const actual=lines.map(line=>{
  if(!Number.isSafeInteger(Number(line?.voucherId))||Number(line.voucherId)!==voucherId)throw new Error("ردیف دفتر کل به سند اصلی متصل نیست یا به سند دیگری تعلق دارد؛ برگشت "+label+" متوقف شد");
  if(line?.id!=null){
   const id=String(line.id);
   if(seenLineIds.has(id))throw new Error("شناسه ردیف سند اصلی "+label+" تکراری است");
   seenLineIds.add(id);
  }
  const normalized=normalizeReversalLine(line,"اصلی "+label);
  if(!accountCodes.has(normalized.accountCode))throw new Error("کد حساب "+normalized.accountCode+" در سند اصلی "+label+" معتبر نیست");
  return normalized;
 });
 let debit=0,credit=0;
 for(const line of actual){
  debit+=line.debitRial;credit+=line.creditRial;
  if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit))throw new Error("جمع سند اصلی "+label+" از محدوده عددی مجاز خارج است");
 }
 if(debit<=0||debit!==credit)throw new Error("سند اصلی "+label+" تراز یا معتبر نیست");
 if(expectedTotal!==null&&expectedTotal!==undefined&&(!Number.isSafeInteger(Number(expectedTotal))||debit!==Number(expectedTotal)))throw new Error("جمع سند اصلی "+label+" با مبلغ عملیات مطابقت ندارد");
 if(expectedLines){
  if(!Array.isArray(expectedLines))throw new Error("ردیف‌های مورد انتظار سند "+label+" معتبر نیست");
  const expected=expectedLines.map(line=>{
   const normalized=normalizeReversalLine(line,"مرجع "+label);
   if(!accountCodes.has(normalized.accountCode))throw new Error("کد حساب "+normalized.accountCode+" در مرجع سند "+label+" معتبر نیست");
   return normalized;
  });
  const signature=line=>line.accountCode+"|"+line.debitRial+"|"+line.creditRial;
  const actualSignatures=actual.map(signature).sort(),expectedSignatures=expected.map(signature).sort();
  if(actualSignatures.length!==expectedSignatures.length||actualSignatures.some((value,index)=>value!==expectedSignatures[index]))throw new Error("حساب یا مبلغ یکی از ردیف‌های سند اصلی "+label+" با عملیات مرجع مطابقت ندارد");
 }
 const reversal=actual.map(line=>({accountCode:line.accountCode,debitRial:line.creditRial,creditRial:line.debitRial,description:"برگشت "+label}));
 validateReversalVoucherPair({originalLines:actual,reversalLines:reversal,label});
 return reversal;
}

const api={validateReversalVoucherLines,validateReversalVoucherPair};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(typeof globalThis!=="undefined")globalThis.HolooReversalValidation=api;
