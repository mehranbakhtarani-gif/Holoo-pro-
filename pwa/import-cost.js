function calculateImportShipmentCost(input){
 const value=input||{};
 const currency=String(value.currency||"");
 const fx=Number(value.fx),goods=Number(value.goods),weight=Number(value.weight);
 const freight=Number(value.freight??0),customs=Number(value.customs??0),other=Number(value.other??0);
 if(!["USD","CNY","EUR"].includes(currency))throw new Error("ارز محموله معتبر نیست");
 if(!Number.isSafeInteger(fx)||fx<=0)throw new Error("نرخ ارز باید عدد صحیح و مثبت باشد");
 if(!Number.isSafeInteger(goods)||goods<=0)throw new Error("بهای کالا باید عدد صحیح و مثبت باشد");
 if(!Number.isFinite(weight)||weight<=0)throw new Error("وزن محموله باید مثبت باشد");
 for(const cost of [freight,customs,other])if(!Number.isSafeInteger(cost)||cost<0)throw new Error("هزینه‌های جانبی باید عدد صحیح و نامنفی باشند");
 const goodsRial=goods*fx,totalCost=goodsRial+freight+customs+other;
 if(!Number.isSafeInteger(goodsRial)||!Number.isSafeInteger(totalCost))throw new Error("بهای تمام‌شده از محدوده عددی مجاز خارج است");
 const unitCost=totalCost/weight;
 if(!Number.isFinite(unitCost))throw new Error("بهای واحد محموله معتبر نیست");
 return {goodsRial,totalCost,unitCost};
}
if(typeof module!=="undefined"&&module.exports)module.exports={calculateImportShipmentCost};
