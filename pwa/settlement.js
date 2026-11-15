function getInvoiceSettlement(invoice, allocations){
 const paid=(allocations||[]).filter(row=>row.invoiceNumber===invoice.number).reduce((sum,row)=>sum+Number(row.amount||0),0);
 const total=Number(invoice.total||0);
 const outstanding=Math.max(0,total-paid);
 return {paid,outstanding,status:invoice.status==="REVERSED"?"REVERSED":outstanding===0?"PAID":paid>0?"PARTIAL":"UNPAID"};
}
function validateTreasuryAllocation(input){
 const transaction=input.transaction,invoice=input.invoice,amount=Number(input.amount),rows=input.allocations||[],currentId=input.currentAllocationId;
 if(!transaction||!invoice||invoice.status==="REVERSED"||!Number.isSafeInteger(amount)||amount<=0)throw new Error("تراکنش، فاکتور فعال و مبلغ تخصیص معتبر الزامی است");
 if(transaction.partyId!==invoice.partyId)throw new Error("طرف حساب تراکنش با فاکتور یکسان نیست");
 if(!((transaction.kind==="RECEIPT"&&invoice.kind==="SALE")||(transaction.kind==="PAYMENT"&&invoice.kind==="PURCHASE")))throw new Error("نوع دریافت/پرداخت با نوع فاکتور سازگار نیست");
 const other=rows.filter(row=>row.id!==currentId);
 const allocatedForTransaction=other.filter(row=>row.treasuryId===transaction.id).reduce((sum,row)=>sum+Number(row.amount||0),0);
 const allocatedForInvoice=other.filter(row=>row.invoiceNumber===invoice.number).reduce((sum,row)=>sum+Number(row.amount||0),0);
 if(allocatedForTransaction+amount>Number(transaction.amount||0))throw new Error("مبلغ تخصیص از مانده تراکنش بیشتر است");
 if(allocatedForInvoice+amount>Number(invoice.total||0))throw new Error("مبلغ تخصیص از مانده فاکتور بیشتر است");
 return true;
}
if(typeof module!=="undefined"&&module.exports)module.exports={getInvoiceSettlement,validateTreasuryAllocation};
