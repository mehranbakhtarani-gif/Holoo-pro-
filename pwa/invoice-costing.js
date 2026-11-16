"use strict";
function allocatePurchaseInventoryCosts(lines,totalCost){
 const rows=Array.isArray(lines)?lines:[];
 const total=Number(totalCost),base=rows.map(line=>Number(line&&line.lineTotal));
 const subtotal=base.reduce((sum,value)=>sum+value,0);
 if(!rows.length||!Number.isSafeInteger(total)||total<=0||!Number.isSafeInteger(subtotal)||subtotal<=0||base.some(value=>!Number.isSafeInteger(value)||value<=0))throw new Error("تخصیص بهای تمام‌شده فاکتور خرید معتبر نیست");
 const target=BigInt(total),denominator=BigInt(subtotal);
 const allocations=base.map((value,index)=>{const product=target*BigInt(value);return {index,cost:Number(product/denominator),remainder:product%denominator}});
 const remaining=total-allocations.reduce((sum,row)=>sum+row.cost,0);
 allocations.slice().sort((a,b)=>a.remainder===b.remainder?a.index-b.index:(a.remainder>b.remainder?-1:1)).slice(0,remaining).forEach(row=>{allocations[row.index].cost++});
 const result=allocations.sort((a,b)=>a.index-b.index).map(row=>row.cost);
 if(result.some(value=>!Number.isSafeInteger(value)||value<0)||result.reduce((sum,value)=>sum+value,0)!==total)throw new Error("جمع تخصیص بهای خرید با مبلغ فاکتور برابر نیست");
 return result;
}
if(typeof module!=="undefined"&&module.exports)module.exports={allocatePurchaseInventoryCosts};
if(typeof globalThis!=="undefined")globalThis.HolooInvoiceCosting={allocatePurchaseInventoryCosts};
