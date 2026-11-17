function getInvoiceSettlement(invoice, allocations){
 if(invoice.status&&invoice.status!=="POSTED"&&invoice.status!=="REVERSED")return {paid:0,outstanding:0,status:"DRAFT"};
 const active=(allocations||[]).filter(row=>row.invoiceNumber===invoice.number&&row.status!=="REVERSED");
 if(active.some(row=>!Number.isSafeInteger(Number(row.amount))||Number(row.amount)<=0))throw new Error("مانده تسویه فاکتور نامعتبر است");
 const paid=active.reduce((sum,row)=>sum+Number(row.amount),0);
 const total=Number(invoice.total||0);
 if(!Number.isSafeInteger(paid)||paid<0||!Number.isSafeInteger(total)||total<0||paid>total)throw new Error("مانده تسویه فاکتور نامعتبر است");
 const outstanding=total-paid;
 return {paid,outstanding,status:invoice.status==="REVERSED"?"REVERSED":outstanding===0?"PAID":paid>0?"PARTIAL":"UNPAID"};
}
function validateTreasuryAllocation(input){
 const transaction=input.transaction,invoice=input.invoice,amount=Number(input.amount),rows=input.allocations||[],currentId=input.currentAllocationId;
 if(!transaction||transaction.status==="REVERSED"||!invoice||(invoice.status&&invoice.status!=="POSTED")||!Number.isSafeInteger(amount)||amount<=0)throw new Error("تراکنش و فاکتور ثبت‌شده و مبلغ تخصیص معتبر الزامی است");
 if(transaction.partyId!==invoice.partyId)throw new Error("طرف حساب تراکنش با فاکتور یکسان نیست");
 if(!((transaction.kind==="RECEIPT"&&invoice.kind==="SALE")||(transaction.kind==="PAYMENT"&&invoice.kind==="PURCHASE")))throw new Error("نوع دریافت/پرداخت با نوع فاکتور سازگار نیست");
 const other=rows.filter(row=>row.id!==currentId&&row.status!=="REVERSED");
 const relevant=other.filter(row=>row.treasuryId===transaction.id||row.invoiceNumber===invoice.number);
 if(relevant.some(row=>!Number.isSafeInteger(Number(row.amount))||Number(row.amount)<=0))throw new Error("مبلغ تخصیص‌های قبلی نامعتبر است");
 const allocatedForTransaction=other.filter(row=>row.treasuryId===transaction.id).reduce((sum,row)=>sum+Number(row.amount),0);
 const allocatedForInvoice=other.filter(row=>row.invoiceNumber===invoice.number).reduce((sum,row)=>sum+Number(row.amount),0);
 const transactionTotal=Number(transaction.amount),invoiceTotal=Number(invoice.total);if(!Number.isSafeInteger(allocatedForTransaction)||!Number.isSafeInteger(allocatedForInvoice)||!Number.isSafeInteger(transactionTotal)||transactionTotal<0||!Number.isSafeInteger(invoiceTotal)||invoiceTotal<0||!Number.isSafeInteger(allocatedForTransaction+amount)||!Number.isSafeInteger(allocatedForInvoice+amount))throw new Error("جمع تخصیص از محدوده عددی مجاز خارج است");
 if(allocatedForTransaction+amount>transactionTotal)throw new Error("مبلغ تخصیص از مانده تراکنش بیشتر است");
 if(allocatedForInvoice+amount>invoiceTotal)throw new Error("مبلغ تخصیص از مانده فاکتور بیشتر است");
 return true;
}
if(typeof module!=="undefined"&&module.exports)module.exports={getInvoiceSettlement,validateTreasuryAllocation};
