const FOREIGN_CURRENCY_MINOR_UNITS=Object.freeze({USD:100,CNY:100,EUR:100});
function convertForeignAmountToRial(input){
 const currency=String(input.currency||"").toUpperCase(),scale=FOREIGN_CURRENCY_MINOR_UNITS[currency];
 const amountMinor=Number(input.amountMinor),fxRate=Number(input.fxRateRialPerUnit);
 if(!scale)throw new Error("ارز خارجی پشتیبانی نمی‌شود");
 if(!Number.isSafeInteger(amountMinor)||amountMinor<0)throw new Error("مبلغ ارزی باید به کوچک‌ترین واحد صحیح و غیرمنفی وارد شود");
 if(!Number.isSafeInteger(fxRate)||fxRate<=0)throw new Error("نرخ تبدیل ارز به ریال معتبر نیست");
 const product=BigInt(amountMinor)*BigInt(fxRate),divisor=BigInt(scale),rialBig=(product+divisor/2n)/divisor;
 if(rialBig>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("معادل ریالی خارج از محدوده مجاز است");
 const rial=Number(rialBig);
 return {currency,amountMinor,fxRateRialPerUnit:fxRate,rial};
}
function calculateRealizedForeignExchange(input){
 const kind=input.kind,currency=String(input.currency||"").toUpperCase();
 if(!["SALE","PURCHASE"].includes(kind))throw new Error("نوع معامله برای محاسبه اختلاف ارز معتبر نیست");
 const invoiceAmountMinor=Number(input.invoiceAmountMinor),settledAmountMinor=Number(input.settledAmountMinor);
 if(!Number.isSafeInteger(invoiceAmountMinor)||invoiceAmountMinor<=0||!Number.isSafeInteger(settledAmountMinor)||settledAmountMinor<=0||settledAmountMinor>invoiceAmountMinor)throw new Error("مبلغ تسویه ارزی از مانده فاکتور معتبر نیست");
 const booked=convertForeignAmountToRial({currency,amountMinor:settledAmountMinor,fxRateRialPerUnit:input.invoiceFxRateRialPerUnit});
 const actual=convertForeignAmountToRial({currency,amountMinor:settledAmountMinor,fxRateRialPerUnit:input.settlementFxRateRialPerUnit});
 const rawDifference=actual.rial-booked.rial;
 const gainRial=kind==="SALE"?Math.max(0,rawDifference):Math.max(0,-rawDifference);
 const lossRial=kind==="SALE"?Math.max(0,-rawDifference):Math.max(0,rawDifference);
 return {currency,settledAmountMinor,bookedRial:booked.rial,settlementRial:actual.rial,differenceRial:rawDifference,gainRial,lossRial};
}
if(typeof module!=="undefined"&&module.exports)module.exports={FOREIGN_CURRENCY_MINOR_UNITS,convertForeignAmountToRial,calculateRealizedForeignExchange};
