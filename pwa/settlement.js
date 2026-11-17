function getInvoiceSettlement(invoice, allocations){
 if(invoice.status&&invoice.status!=="POSTED"&&invoice.status!=="REVERSED")return {paid:0,outstanding:0,status:"DRAFT"};
 const paid=(allocations||[]).filter(row=>row.invoiceNumber===invoice.number&&row.status!=="REVERSED").reduce((sum,row)=>sum+Number(row.amount||0),0);
 const total=Number(invoice.total||0);
 if(!Number.isSafeInteger(paid)||paid<0||!Number.isSafeInteger(total)||total<0||paid>total)throw new Error("مانده تسویه فاکتور نامعتبر است");
 const outstanding=total-paid;
 return {paid,outstanding,status:invoice.status==="REVERSED"?"REVERSED":outstanding===0?"PAID":paid>0?"PARTIAL":"UNPAID"};
}
function calculateTreasuryForeignAllocation(input){
 const transaction=input.transaction,amount=Number(input.amount),rows=input.allocations||[];
 const totalRial=Number(transaction?.amount),totalForeign=Number(transaction?.foreignAmountMinor),transactionId=Number(transaction?.id);
 if(!transaction||!Number.isSafeInteger(transactionId)||transactionId<=0||!["USD","CNY","EUR"].includes(String(transaction.currency||"").toUpperCase())||!Number.isSafeInteger(totalRial)||totalRial<=0||!Number.isSafeInteger(totalForeign)||totalForeign<=0||!Number.isSafeInteger(amount)||amount<=0)throw new Error("اطلاعات تخصیص ارزی تراکنش معتبر نیست");
 const active=rows.filter(row=>row&&row.status!=="REVERSED"&&Number(row.treasuryId)===transactionId);
 const allocatedRial=active.reduce((sum,row)=>sum+Number(row.amount),0),allocatedForeign=active.reduce((sum,row)=>sum+Number(row.foreignAmountMinor),0);
 if(!Number.isSafeInteger(allocatedRial)||allocatedRial<0||!Number.isSafeInteger(allocatedForeign)||allocatedForeign<0||allocatedRial>totalRial||allocatedForeign>totalForeign)throw new Error("سوابق تخصیص ارزی تراکنش نامعتبر است");
 const remainingRial=totalRial-allocatedRial,remainingForeign=totalForeign-allocatedForeign;
 if(amount>remainingRial||remainingForeign<=0)throw new Error("مبلغ تخصیص از مانده ارزی تراکنش بیشتر است");
 const foreignAmountMinor=amount===remainingRial?remainingForeign:Number((BigInt(amount)*BigInt(remainingForeign)*2n+BigInt(remainingRial))/(2n*BigInt(remainingRial)));
 if(!Number.isSafeInteger(foreignAmountMinor)||foreignAmountMinor<=0||foreignAmountMinor>remainingForeign)throw new Error("مبلغ ارزی تخصیص معتبر نیست یا از دقت کوچک‌ترین واحد ارز کمتر است");
 return foreignAmountMinor;
}
function validateTreasuryAllocation(input){
 const transaction=input.transaction,invoice=input.invoice,amount=Number(input.amount),rows=input.allocations||[],currentId=input.currentAllocationId;
 if(!transaction||transaction.status==="REVERSED"||!invoice||(invoice.status&&invoice.status!=="POSTED")||!Number.isSafeInteger(amount)||amount<=0)throw new Error("تراکنش و فاکتور ثبت‌شده و مبلغ تخصیص معتبر الزامی است");
 if(transaction.partyId!==invoice.partyId)throw new Error("طرف حساب تراکنش با فاکتور یکسان نیست");
 if(!((transaction.kind==="RECEIPT"&&invoice.kind==="SALE")||(transaction.kind==="PAYMENT"&&invoice.kind==="PURCHASE")))throw new Error("نوع دریافت/پرداخت با نوع فاکتور سازگار نیست");
 const other=rows.filter(row=>row.id!==currentId&&row.status!=="REVERSED");
 const allocatedForTransaction=other.filter(row=>row.treasuryId===transaction.id).reduce((sum,row)=>sum+Number(row.amount||0),0);
 const allocatedForInvoice=other.filter(row=>row.invoiceNumber===invoice.number).reduce((sum,row)=>sum+Number(row.amount||0),0);
 const transactionTotal=Number(transaction.amount||0),invoiceTotal=Number(invoice.total||0);if(!Number.isSafeInteger(allocatedForTransaction)||!Number.isSafeInteger(allocatedForInvoice)||!Number.isSafeInteger(transactionTotal)||!Number.isSafeInteger(invoiceTotal)||!Number.isSafeInteger(allocatedForTransaction+amount)||!Number.isSafeInteger(allocatedForInvoice+amount))throw new Error("جمع تخصیص از محدوده عددی مجاز خارج است");
 if(allocatedForTransaction+amount>transactionTotal)throw new Error("مبلغ تخصیص از مانده تراکنش بیشتر است");
 if(allocatedForInvoice+amount>invoiceTotal)throw new Error("مبلغ تخصیص از مانده فاکتور بیشتر است");
 return true;
}
if(typeof module!=="undefined"&&module.exports)module.exports={getInvoiceSettlement,validateTreasuryAllocation,calculateTreasuryForeignAllocation};
