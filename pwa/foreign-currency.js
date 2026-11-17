const FOREIGN_CURRENCY_MINOR_UNITS=Object.freeze({USD:100,CNY:100,EUR:100});
function roundPositiveRatio(numerator,denominator){
 const rounded=(numerator+denominator/2n)/denominator;
 if(rounded>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("معادل تبدیل ارز خارج از محدوده عددی مجاز است");
 return Number(rounded);
}
function convertForeignAmountToRial(input){
 const currency=String(input.currency||"").toUpperCase(),scale=FOREIGN_CURRENCY_MINOR_UNITS[currency];
 const amountMinor=Number(input.amountMinor),fxRate=Number(input.fxRateRialPerUnit);
 if(!scale)throw new Error("ارز خارجی پشتیبانی نمی‌شود");
 if(!Number.isSafeInteger(amountMinor)||amountMinor<0)throw new Error("مبلغ ارزی باید به کوچک‌ترین واحد صحیح و غیرمنفی وارد شود");
 if(!Number.isSafeInteger(fxRate)||fxRate<=0)throw new Error("نرخ تبدیل ارز به ریال معتبر نیست");
 const rial=roundPositiveRatio(BigInt(amountMinor)*BigInt(fxRate),BigInt(scale));
 return {currency,amountMinor,fxRateRialPerUnit:fxRate,rial};
}
function convertRialToForeignMinor(input){
 const currency=String(input.currency||"").toUpperCase(),scale=FOREIGN_CURRENCY_MINOR_UNITS[currency];
 const rial=Number(input.rial),fxRate=Number(input.fxRateRialPerUnit);
 if(!scale)throw new Error("ارز خارجی پشتیبانی نمی‌شود");
 if(!Number.isSafeInteger(rial)||rial<0)throw new Error("مبلغ ریالی برای تبدیل ارز معتبر نیست");
 if(!Number.isSafeInteger(fxRate)||fxRate<=0)throw new Error("نرخ تبدیل ارز به ریال معتبر نیست");
 return roundPositiveRatio(BigInt(rial)*BigInt(scale),BigInt(fxRate));
}
function calculateCumulativeRealizedForeignExchange(input){
 const kind=input.kind,currency=String(input.currency||"").toUpperCase();
 if(!["SALE","PURCHASE"].includes(kind))throw new Error("نوع معامله برای محاسبه اختلاف ارز معتبر نیست");
 const invoiceAmountMinor=Number(input.invoiceAmountMinor),settledAmountMinor=Number(input.settledAmountMinor),previousInvoiceMinor=Number(input.previousInvoiceSettledMinor||0),previousInvoiceBookedRial=Number(input.previousInvoiceBookedRial||0);
 const treasuryAmountMinor=Number(input.treasuryAmountMinor),previousTreasuryMinor=Number(input.previousTreasurySettledMinor||0),previousTreasurySettlementRial=Number(input.previousTreasurySettlementRial||0);
 const invoiceTotalRial=Number(input.invoiceTotalRial),treasuryTotalRial=Number(input.treasuryTotalRial);
 if(!Number.isSafeInteger(invoiceAmountMinor)||invoiceAmountMinor<=0||!Number.isSafeInteger(settledAmountMinor)||settledAmountMinor<=0||!Number.isSafeInteger(previousInvoiceMinor)||previousInvoiceMinor<0||!Number.isSafeInteger(previousInvoiceBookedRial)||previousInvoiceBookedRial<0||!Number.isSafeInteger(treasuryAmountMinor)||treasuryAmountMinor<=0||!Number.isSafeInteger(previousTreasuryMinor)||previousTreasuryMinor<0||!Number.isSafeInteger(previousTreasurySettlementRial)||previousTreasurySettlementRial<0||!Number.isSafeInteger(invoiceTotalRial)||invoiceTotalRial<=0||!Number.isSafeInteger(treasuryTotalRial)||treasuryTotalRial<=0)throw new Error("مقادیر تجمعی تسویه ارزی معتبر نیست");
 const invoiceCumulativeMinor=previousInvoiceMinor+settledAmountMinor,treasuryCumulativeMinor=previousTreasuryMinor+settledAmountMinor;
 if(!Number.isSafeInteger(invoiceCumulativeMinor)||invoiceCumulativeMinor>invoiceAmountMinor||!Number.isSafeInteger(treasuryCumulativeMinor)||treasuryCumulativeMinor>treasuryAmountMinor)throw new Error("مبلغ تجمعی تسویه از مانده ارزی فاکتور یا تراکنش بیشتر است");
 const invoiceCumulativeRial=invoiceCumulativeMinor===invoiceAmountMinor?invoiceTotalRial:convertForeignAmountToRial({currency,amountMinor:invoiceCumulativeMinor,fxRateRialPerUnit:input.invoiceFxRateRialPerUnit}).rial;
 const treasuryCumulativeRial=treasuryCumulativeMinor===treasuryAmountMinor?treasuryTotalRial:convertForeignAmountToRial({currency,amountMinor:treasuryCumulativeMinor,fxRateRialPerUnit:input.settlementFxRateRialPerUnit}).rial;
 const bookedRial=invoiceCumulativeRial-previousInvoiceBookedRial,settlementRial=treasuryCumulativeRial-previousTreasurySettlementRial;
 if(!Number.isSafeInteger(bookedRial)||bookedRial<0||!Number.isSafeInteger(settlementRial)||settlementRial<0)throw new Error("ارزش تجمعی تسویه ارزی با سوابق قبلی سازگار نیست");
 const differenceRial=settlementRial-bookedRial;
 if(!Number.isSafeInteger(differenceRial))throw new Error("اختلاف تسعیر از محدوده عددی مجاز خارج است");
 const gainRial=kind==="SALE"?Math.max(0,differenceRial):Math.max(0,-differenceRial),lossRial=kind==="SALE"?Math.max(0,-differenceRial):Math.max(0,differenceRial);
 return {currency,settledAmountMinor,bookedRial,settlementRial,differenceRial,gainRial,lossRial,invoiceCumulativeMinor,treasuryCumulativeMinor};
}

function buildRealizedForeignExchangeRows(input){
 const allocations=(input.allocations||[]).filter(row=>row&&row.status!=="REVERSED"&&(Number(row.fxGainRial||0)>0||Number(row.fxLossRial||0)>0));
 const payments=(input.foreignPayments||[]).filter(row=>row&&row.status!=="REVERSED"&&(Number(row.fxGainRial||0)>0||Number(row.fxLossRial||0)>0));
 return [...allocations,...payments].sort((a,b)=>Number(b.date||0)-Number(a.date||0));
}
function calculateRealizedForeignExchange(input){
 const kind=input.kind,currency=String(input.currency||"").toUpperCase();
 if(!["SALE","PURCHASE"].includes(kind))throw new Error("نوع معامله برای محاسبه اختلاف ارز معتبر نیست");
 const invoiceAmountMinor=Number(input.invoiceAmountMinor),settledAmountMinor=Number(input.settledAmountMinor);
 if(!Number.isSafeInteger(invoiceAmountMinor)||invoiceAmountMinor<=0||!Number.isSafeInteger(settledAmountMinor)||settledAmountMinor<=0||settledAmountMinor>invoiceAmountMinor)throw new Error("مبلغ تسویه ارزی از مانده فاکتور معتبر نیست");
 const booked=convertForeignAmountToRial({currency,amountMinor:settledAmountMinor,fxRateRialPerUnit:input.invoiceFxRateRialPerUnit});
 const actual=convertForeignAmountToRial({currency,amountMinor:settledAmountMinor,fxRateRialPerUnit:input.settlementFxRateRialPerUnit});
 const rawDifference=actual.rial-booked.rial;
 if(!Number.isSafeInteger(rawDifference))throw new Error("اختلاف تسعیر از محدوده عددی مجاز خارج است");
 const gainRial=kind==="SALE"?Math.max(0,rawDifference):Math.max(0,-rawDifference);
 const lossRial=kind==="SALE"?Math.max(0,-rawDifference):Math.max(0,rawDifference);
 return {currency,settledAmountMinor,bookedRial:booked.rial,settlementRial:actual.rial,differenceRial:rawDifference,gainRial,lossRial};
}
if(typeof module!=="undefined"&&module.exports)module.exports={FOREIGN_CURRENCY_MINOR_UNITS,convertForeignAmountToRial,convertRialToForeignMinor,calculateRealizedForeignExchange,calculateCumulativeRealizedForeignExchange,buildRealizedForeignExchangeRows};
