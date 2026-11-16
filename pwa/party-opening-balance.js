"use strict";
function planPartyOpeningBalance(input){
 const value=input||{},partyKind=String(value.partyKind||""),balance=Number(value.balance);
 if(!["CUSTOMER","SUPPLIER","BOTH"].includes(partyKind))throw new Error("نوع طرف حساب برای مانده افتتاحیه معتبر نیست");
 if(!Number.isSafeInteger(balance))throw new Error("مانده افتتاحیه باید عدد صحیح ریالی باشد");
 if(balance===0)return {balance:0,debitRial:0,creditRial:0,journal:[]};
 const amount=Math.abs(balance);
 const debitAccountCode=balance>0?(partyKind==="SUPPLIER"?"2101":"1103"):"3102";
 const creditAccountCode=balance>0?"3102":(partyKind==="CUSTOMER"?"1103":"2101");
 return {
  balance,
  debitRial:balance>0?amount:0,
  creditRial:balance<0?amount:0,
  journal:[
   {accountCode:debitAccountCode,debitRial:amount,creditRial:0,description:"ثبت مانده افتتاحیه طرف حساب"},
   {accountCode:creditAccountCode,debitRial:0,creditRial:amount,description:"طرف مقابل مانده افتتاحیه"}
  ]
 };
}
if(typeof module!=="undefined"&&module.exports)module.exports={planPartyOpeningBalance};
if(typeof globalThis!=="undefined")globalThis.HolooPartyOpeningBalance={planPartyOpeningBalance};
