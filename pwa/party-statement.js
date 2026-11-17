(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.HolooPartyStatement=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 function calculatePartyStatement(party,ledger){
  if(!party||!Number.isFinite(Number(party.id)))throw new Error("طرف حساب معتبر نیست");
  const id=Number(party.id);
  const rows=(Array.isArray(ledger)?ledger:[])
   .filter(row=>Number(row.partyId)===id&&!String(row.referenceId||"").startsWith("OPENING:PARTY:"))
   .slice()
   .sort((a,b)=>Number(a.date||0)-Number(b.date||0)||Number(a.id||0)-Number(b.id||0));
  const movement=rows.reduce((sum,row)=>sum+Number(row.debitRial||0)-Number(row.creditRial||0),0);
  const opening=Number(party.balance||0)-movement;
  if(!Number.isSafeInteger(opening))throw new Error("مانده صورتحساب از محدوده عدد صحیح ریالی خارج است");
  let balance=opening;
  const result=[{opening:true,date:null,description:"مانده افتتاحیه",debitRial:Math.max(0,opening),creditRial:Math.max(0,-opening),balance:opening}];
  for(const row of rows){
   const debit=Number(row.debitRial||0),credit=Number(row.creditRial||0);
   if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit)||debit<0||credit<0||debit&&credit)throw new Error("گردش طرف حساب دارای مبلغ بدهکار/بستانکار نامعتبر است");
   balance+=debit-credit;
   if(!Number.isSafeInteger(balance))throw new Error("مانده صورتحساب از محدوده عدد صحیح ریالی خارج است");
   result.push({opening:false,date:Number(row.date||0),description:String(row.description||""),debitRial:debit,creditRial:credit,balance});
  }
  return result;
 }
 return {calculatePartyStatement};
});
