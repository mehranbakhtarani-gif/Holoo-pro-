function convertForeignGoodsToRial(goodsValue,fxValue){
 const goods=Number(goodsValue),fx=Number(fxValue);
 if(!Number.isSafeInteger(fx)||fx<=0)throw new Error("نرخ ارز باید عدد صحیح و مثبت باشد");
 if(!Number.isFinite(goods)||goods<=0)throw new Error("بهای کالا باید مثبت باشد");
 const goodsMinor=Math.round(goods*100);
 if(!Number.isSafeInteger(goodsMinor)||goodsMinor<=0||Math.abs(goods*100-goodsMinor)>1e-7)throw new Error("مبلغ ارزی کالا حداکثر باید دو رقم اعشار داشته باشد");
 const rial=(BigInt(goodsMinor)*BigInt(fx)+50n)/100n;
 if(rial>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("بهای ریالی کالا از محدوده عددی مجاز خارج است");
 return {goodsMinor,goodsRial:Number(rial)};
}
function calculateImportShipmentCost(input){
 const value=input||{},currency=String(value.currency||"");
 const fx=Number(value.fx),goods=Number(value.goods),weight=Number(value.weight);
 const fields=["freight","customs","insurance","port","inland","broker","storage","bank","other"];
 const breakdown={};for(const field of fields){const amount=Number(value[field]??0);if(!Number.isSafeInteger(amount)||amount<0)throw new Error("هزینه‌های جانبی باید عدد صحیح و نامنفی باشند");breakdown[field]=amount}
 if(!["USD","CNY","EUR"].includes(currency))throw new Error("ارز محموله معتبر نیست");
 if(!Number.isSafeInteger(fx)||fx<=0)throw new Error("نرخ ارز باید عدد صحیح و مثبت باشد");
 if(!Number.isFinite(goods)||goods<=0)throw new Error("بهای کالا باید مثبت باشد");
 if(!Number.isFinite(weight)||weight<=0)throw new Error("وزن محموله باید مثبت باشد");
 const converted=convertForeignGoodsToRial(goods,fx),goodsRial=converted.goodsRial,ancillary=fields.reduce((sum,key)=>sum+breakdown[key],0),totalCost=goodsRial+ancillary;
 if(!Number.isSafeInteger(goodsRial)||!Number.isSafeInteger(ancillary)||!Number.isSafeInteger(totalCost))throw new Error("بهای تمام‌شده از محدوده عددی مجاز خارج است");
 const unitCost=totalCost/weight;if(!Number.isFinite(unitCost))throw new Error("بهای واحد محموله معتبر نیست");
 return {goodsRial,totalCost,unitCost,ancillary,breakdown};
}
if(typeof module!=="undefined"&&module.exports)module.exports={calculateImportShipmentCost,convertForeignGoodsToRial};
