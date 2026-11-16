function calculateImportShipmentCost(input){
 const value=input||{},currency=String(value.currency||"");
 const fx=Number(value.fx),goods=Number(value.goods),weight=Number(value.weight);
 const fields=["freight","customs","insurance","port","inland","broker","storage","bank","other"];
 const breakdown={};for(const field of fields){const amount=Number(value[field]??0);if(!Number.isSafeInteger(amount)||amount<0)throw new Error("هزینه‌های جانبی باید عدد صحیح و نامنفی باشند");breakdown[field]=amount}
 if(!["USD","CNY","EUR"].includes(currency))throw new Error("ارز محموله معتبر نیست");
 if(!Number.isSafeInteger(fx)||fx<=0)throw new Error("نرخ ارز باید عدد صحیح و مثبت باشد");
 if(!Number.isSafeInteger(goods)||goods<=0)throw new Error("بهای کالا باید عدد صحیح و مثبت باشد");
 if(!Number.isFinite(weight)||weight<=0)throw new Error("وزن محموله باید مثبت باشد");
 const goodsRial=goods*fx,ancillary=fields.reduce((sum,key)=>sum+breakdown[key],0),totalCost=goodsRial+ancillary;
 if(!Number.isSafeInteger(goodsRial)||!Number.isSafeInteger(ancillary)||!Number.isSafeInteger(totalCost))throw new Error("بهای تمام‌شده از محدوده عددی مجاز خارج است");
 const unitCost=totalCost/weight;if(!Number.isFinite(unitCost))throw new Error("بهای واحد محموله معتبر نیست");
 return {goodsRial,totalCost,unitCost,ancillary,breakdown};
}
if(typeof module!=="undefined"&&module.exports)module.exports={calculateImportShipmentCost};
