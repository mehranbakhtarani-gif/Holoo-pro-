(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.HolooFinancialRules=api;
})(globalThis,function(){
 "use strict";
 const PROTECTED_STORES=new Set(["invoices","vouchers","voucherLines","treasury","partyLedger","stockAdjustments"]);
 function validateTreasurySettlement({kind,amount,balance,method,partyKind}){
  if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("طرف حساب و مبلغ صحیح و مثبت (ریال) الزامی است");
  if(method!=="صندوق"&&method!=="بانک")throw new Error("روش دریافت یا پرداخت معتبر نیست");
  if(!Number.isSafeInteger(balance))throw new Error("مانده طرف حساب باید عدد صحیح ریالی باشد");
  if(kind!=="RECEIPT"&&kind!=="PAYMENT")throw new Error("نوع عملیات خزانه معتبر نیست");
  if(kind==="RECEIPT"&&partyKind==="SUPPLIER")throw new Error("نوع طرف حساب با دریافت انتخاب‌شده سازگار نیست");
  if(kind==="PAYMENT"&&partyKind==="CUSTOMER")throw new Error("نوع طرف حساب با پرداخت انتخاب‌شده سازگار نیست");
  if(kind==="RECEIPT"){
   if(balance<=0)throw new Error("این طرف حساب مانده بدهکار ندارد؛ دریافت وجه به‌عنوان تسویه مطالبات مجاز نیست");
   if(amount>balance)throw new Error("مبلغ دریافت از مانده بدهکار طرف حساب بیشتر است؛ دریافت علی‌الحساب هنوز پشتیبانی نمی‌شود");
  }else{
   if(balance>=0)throw new Error("این طرف حساب مانده بستانکار ندارد؛ پرداخت وجه به‌عنوان تسویه بدهی مجاز نیست");
   if(amount>-balance)throw new Error("مبلغ پرداخت از مانده بدهی طرف حساب بیشتر است؛ پرداخت علی‌الحساب هنوز پشتیبانی نمی‌شود");
  }
  return true;
 }
 function isProtectedFinancialStore(name){return PROTECTED_STORES.has(String(name))}
 function accountKey(account){return String(account?.id??account?.code??"")}
 return Object.freeze({validateTreasurySettlement,isProtectedFinancialStore,accountKey});
});
