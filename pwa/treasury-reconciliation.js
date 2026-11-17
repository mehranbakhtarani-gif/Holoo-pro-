"use strict";
function safeAmount(value,label){
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<0)throw new Error(label+" باید عدد صحیح و غیرمنفی باشد");
 return n;
}
function signature(line){return String(line.accountCode)+"|"+Number(line.debitRial||0)+"|"+Number(line.creditRial||0)}
function validateLines(lines,accounts,label){
 if(!Array.isArray(lines)||lines.length<2)throw new Error("ردیف‌های "+label+" ناقص است");
 const codes=new Set((accounts||[]).map(x=>String(x.id)));
 let debit=0,credit=0;
 for(const line of lines){
  const code=String(line.accountCode??"").trim(),d=safeAmount(line.debitRial||0,label+" بدهکار"),c=safeAmount(line.creditRial||0,label+" بستانکار");
  if(!code||!codes.has(code))throw new Error("کد حساب "+(code||"(خالی)")+" در "+label+" تعریف نشده است");
  if((d>0)===(c>0))throw new Error("یکی از ردیف‌های "+label+" باید فقط در یک سمت مبلغ داشته باشد");
  debit+=d;credit+=c;
  if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit))throw new Error("جمع ردیف‌های "+label+" از محدوده عددی مجاز خارج است");
 }
 if(debit<=0||debit!==credit)throw new Error("جمع بدهکار و بستانکار "+label+" برابر نیست");
 return {debit,credit,lines:lines.map(x=>({accountCode:String(x.accountCode),debitRial:Number(x.debitRial||0),creditRial:Number(x.creditRial||0)}))};
}
function compareLines(actual,expected,label){
 const a=actual.map(signature).sort(),e=expected.map(signature).sort();
 if(a.length!==e.length||a.some((x,i)=>x!==e[i]))throw new Error("حساب یا مبلغ ردیف‌های "+label+" با عملیات مرجع مطابقت ندارد");
}
function cashCode(method){
 if(method==="بانک")return "1102";
 if(method==="صندوق")return "1101";
 throw new Error("روش خزانه باید بانک یا صندوق باشد");
}
function reverseLines(lines){return lines.map(x=>({accountCode:String(x.accountCode),debitRial:Number(x.creditRial||0),creditRial:Number(x.debitRial||0)}))}
function opposite(kind){return kind==="RECEIPT"?"PAYMENT":kind==="PAYMENT"?"RECEIPT":""}
function reconcileTreasuryRecords(input){
 const treasury=Array.isArray(input.treasury)?input.treasury:[],vouchers=Array.isArray(input.vouchers)?input.vouchers:[],voucherLines=Array.isArray(input.voucherLines)?input.voucherLines:[],accounts=Array.isArray(input.accounts)?input.accounts:[],parties=Array.isArray(input.parties)?input.parties:[],partyLedger=Array.isArray(input.partyLedger)?input.partyLedger:[],checks=Array.isArray(input.checks)?input.checks:[],payroll=Array.isArray(input.payroll)?input.payroll:[],foreignPayments=Array.isArray(input.foreignPayments)?input.foreignPayments:[];
 const referenceCounts=new Map();for(const row of treasury){const ref=String(row.reference||"");if(ref)referenceCounts.set(ref,(referenceCounts.get(ref)||0)+1)}
 const rows=treasury.map(record=>{
  const issues=[],reference=String(record.reference||""),amount=Number(record.amount),isParty=Number.isSafeInteger(Number(record.partyId))&&Number(record.partyId)>0;
  let voucher=null,lines=[],expected=null,sourceOriginal=null,foreignPayment=null,ledgerAmount=amount,party=null;
  const add=message=>{if(!issues.includes(message))issues.push(message)},safeCashCode=method=>{try{return cashCode(method)}catch(error){add(error.message);return ""}};
  if(!reference)add("شناسه مرجع خزانه خالی است");
  if(reference&&referenceCounts.get(reference)!==1)add("شناسه مرجع خزانه تکراری است");
  if(!Number.isSafeInteger(amount)||amount<=0)add("مبلغ خزانه معتبر نیست");
  const voucherMatches=vouchers.filter(x=>x.reference===reference);
  if(voucherMatches.length!==1)add(voucherMatches.length?"سند حسابداری مرجع تکراری است":"سند حسابداری مرجع پیدا نشد");
  else{
   voucher=voucherMatches[0];lines=voucherLines.filter(x=>Number(x.voucherId)===Number(voucher.id));
   try{validateLines(lines,accounts,"سند "+reference)}catch(error){add(error.message)}
  }
  const reversalRef=record.reversalOf||"";
  if(record.reversalOfId!==undefined&&record.reversalOfId!==null||reversalRef){
   const originals=treasury.filter(x=>record.reversalOfId!==undefined&&record.reversalOfId!==null?Number(x.id)===Number(record.reversalOfId):x.reference===reversalRef);
   if(originals.length!==1)add("گردش خزانه اصلی برای این برگشت یکتا نیست");
   else{
    sourceOriginal=originals[0];
    if(sourceOriginal.status!=="REVERSED")add("وضعیت گردش اصلی به برگشت‌شده تغییر نکرده است");
    if(record.kind!==opposite(sourceOriginal.kind))add("نوع دریافت/پرداخت رکورد برگشت با گردش اصلی متضاد نیست");
    if(Number(record.amount)!==Number(sourceOriginal.amount)||Number(record.partyId||0)!==Number(sourceOriginal.partyId||0)||record.method!==sourceOriginal.method)add("مبلغ، طرف حساب یا روش گردش برگشت با اصل تراکنش متفاوت است");
    const sourceVouchers=vouchers.filter(x=>x.reference===sourceOriginal.reference);
    if(sourceVouchers.length!==1)add("سند اصلی گردش برگشتی یکتا نیست");
    else{
     const sourceLines=voucherLines.filter(x=>Number(x.voucherId)===Number(sourceVouchers[0].id));
     try{validateLines(sourceLines,accounts,"سند اصلی برگشت");expected=reverseLines(sourceLines)}catch(error){add(error.message)}
    }
    if(sourceOriginal.foreignPayableId){
     const matches=foreignPayments.filter(x=>x.reference===sourceOriginal.reference);foreignPayment=matches[0]||null;
     if(matches.length!==1)add("جزئیات پرداخت ارزی اصلی برای برگشت یکتا نیست");else ledgerAmount=Number(foreignPayment.bookedRial);
    }
   }
  }else if(record.foreignPayableId){
   const matches=foreignPayments.filter(x=>x.reference===reference);
   if(matches.length!==1)add(matches.length?"جزئیات پرداخت ارزی تکراری است":"جزئیات پرداخت ارزی پیدا نشد");
   else{
    foreignPayment=matches[0];ledgerAmount=Number(foreignPayment.bookedRial);
    if(Number(foreignPayment.payableId)!==Number(record.foreignPayableId)||Number(foreignPayment.settlementRial)!==amount||Number(foreignPayment.amountMinor)!==Number(record.foreignAmountMinor)||foreignPayment.method!==record.method||Number(foreignPayment.supplierId)!==Number(record.partyId))add("مبلغ یا پیوند پرداخت ارزی با گردش خزانه متفاوت است");
    const cash=safeCashCode(record.method);
    expected=[{accountCode:"2101",debitRial:Number(foreignPayment.bookedRial),creditRial:0},{accountCode:cash,debitRial:0,creditRial:Number(foreignPayment.settlementRial)}];
    if(Number(foreignPayment.fxGainRial||0)>0)expected.push({accountCode:"4301",debitRial:0,creditRial:Number(foreignPayment.fxGainRial)});
    if(Number(foreignPayment.fxLossRial||0)>0)expected.push({accountCode:"5501",debitRial:Number(foreignPayment.fxLossRial),creditRial:0});
   }
  }else if(record.importAncillaryPayment===true){
   if(record.kind!=="PAYMENT")add("پرداخت هزینه جانبی باید از نوع پرداخت باشد");
   expected=[{accountCode:"2102",debitRial:amount,creditRial:0},{accountCode:cashCode(record.method),debitRial:0,creditRial:amount}];
  }else if(record.checkId){
   const check=checks.find(x=>Number(x.id)===Number(record.checkId));
   if(!check)add("چک مرجع خزانه پیدا نشد");
   else{
    const kind=check.kind==="RECEIVED"?"RECEIPT":check.kind==="PAYABLE"?"PAYMENT":"";
    if(!kind||record.kind!==kind||Number(check.partyId)!==Number(record.partyId)||Number(check.amount)!==amount||record.method!=="بانک")add("گردش خزانه با نوع، مبلغ یا طرف حساب چک مطابقت ندارد");
    expected=kind==="RECEIPT"?[{accountCode:"1102",debitRial:amount,creditRial:0},{accountCode:"1103",debitRial:0,creditRial:amount}]:[{accountCode:"2101",debitRial:amount,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:amount}];
   }
  }else if(reference.startsWith("PAYROLL-PAYMENT:")){
   const payrollId=Number(reference.split(":")[1]),row=payroll.find(x=>Number(x.id)===payrollId);
   if(!row||row.status!=="پرداخت‌شده"||Number(row.net)!==amount)add("گردش خزانه با حقوق پرداخت‌شده مطابقت ندارد");
   expected=[{accountCode:"2104",debitRial:amount,creditRial:0},{accountCode:cashCode(record.method),debitRial:0,creditRial:amount}];
  }else if(reference.startsWith("TREASURY:")){
   party=parties.find(x=>Number(x.id)===Number(record.partyId));
   if(!party)add("طرف حساب گردش خزانه پیدا نشد");
   if(!["RECEIPT","PAYMENT"].includes(record.kind))add("نوع گردش خزانه معتبر نیست");
   const cash=cashCode(record.method);
   if(record.kind==="RECEIPT"){
    const account=party?.kind==="SUPPLIER"?"2101":"1103";
    expected=[{accountCode:cash,debitRial:amount,creditRial:0},{accountCode:account,debitRial:0,creditRial:amount}];
   }else if(record.kind==="PAYMENT"){
    const account=party?.kind==="CUSTOMER"?"1103":"2101";
    expected=[{accountCode:account,debitRial:amount,creditRial:0},{accountCode:cash,debitRial:0,creditRial:amount}];
   }
  }else add("نوع گردش خزانه برای تطبیق خودکار پشتیبانی نمی‌شود");
  if(expected&&voucher){try{compareLines(lines,expected,"سند خزانه "+reference)}catch(error){add(error.message)}}
  if(isParty){
   party=party||parties.find(x=>Number(x.id)===Number(record.partyId));
   if(!party)add("طرف حساب گردش خزانه پیدا نشد");
   const matches=partyLedger.filter(x=>x.referenceId===reference);
   if(matches.length!==1)add(matches.length?"گردش تفصیلی خزانه تکراری است":"گردش تفصیلی خزانه پیدا نشد");
   else{
    const row=matches[0],debit=record.kind==="PAYMENT"?ledgerAmount:0,credit=record.kind==="RECEIPT"?ledgerAmount:0;
    if(Number(row.partyId)!==Number(record.partyId)||Number(row.debitRial||0)!==debit||Number(row.creditRial||0)!==credit)add("مبلغ یا طرف حساب گردش تفصیلی با خزانه مطابقت ندارد");
   }
  }else if(partyLedger.some(x=>x.referenceId===reference))add("برای گردش بدون طرف حساب، گردش تفصیلی غیرمنتظره ثبت شده است");
  if(record.status==="REVERSED"){
   const reversals=treasury.filter(x=>Number(x.reversalOfId)===Number(record.id)||x.reversalOf===reference);
   if(reversals.length!==1)add(reversals.length?"تعداد اسناد برگشت گردش خزانه تکراری است":"سند برگشت برای گردش خزانه ثبت نشده است");
  }else if(treasury.some(x=>Number(x.reversalOfId)===Number(record.id)||x.reversalOf===reference))add("برای گردش فعال، سند برگشت غیرمنتظره وجود دارد");
  return {id:record.id,reference,kind:record.kind,method:record.method,partyName:record.partyName||"",amount,foreignAmountMinor:record.foreignAmountMinor||null,voucherNumber:voucher?.number||"",ok:issues.length===0,issues};
 });
 return {total:rows.length,matched:rows.filter(x=>x.ok).length,withIssues:rows.filter(x=>!x.ok).length,rows};
}
const TreasuryIntegrity={reconcileTreasuryRecords};
if(typeof module!=="undefined")module.exports=TreasuryIntegrity;
if(typeof globalThis!=="undefined")globalThis.HolooTreasuryIntegrity=TreasuryIntegrity;
