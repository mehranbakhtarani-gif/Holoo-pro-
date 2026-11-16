function summarizeImportShipments(input){
 const shipments=Array.isArray(input.shipments)?input.shipments:[];
 const statusCounts=new Map(),byProduct=new Map(),bySupplier=new Map(),foreignGoods=Object.create(null);
 let totalWeight=0,totalGoodsRial=0,totalAncillary=0,totalLanded=0,receivedWeight=0,receivedCost=0,inTransitWeight=0;
 const rows=shipments.map(s=>{
  if(!s||!Number.isFinite(Number(s.weight))||Number(s.weight)<=0)throw new Error("وزن محموله برای گزارش معتبر نیست");
  const goodsRial=Number(s.goodsRial),totalCost=Number(s.totalCost);
  if(!Number.isSafeInteger(goodsRial)||goodsRial<0||!Number.isSafeInteger(totalCost)||totalCost<goodsRial)throw new Error("بهای ریالی محموله معتبر نیست: "+String(s.number||""));
  const ancillary=totalCost-goodsRial,weight=Number(s.weight),unitCost=totalCost/weight,status=String(s.status||"نامشخص"),currency=String(s.currency||"نامشخص");
  if(!Number.isFinite(unitCost))throw new Error("بهای هر کیلو محموله معتبر نیست: "+String(s.number||""));
  const foreignAmount=Number(s.goods??0);if(!Number.isFinite(foreignAmount)||foreignAmount<0)throw new Error("مبلغ ارزی محموله معتبر نیست: "+String(s.number||""));
  totalWeight+=weight;totalGoodsRial+=goodsRial;totalAncillary+=ancillary;totalLanded+=totalCost;
  if(status==="رسید انبار شده"||status==="تسویه‌شده"){receivedWeight+=weight;receivedCost+=totalCost}else inTransitWeight+=weight;
  statusCounts.set(status,(statusCounts.get(status)||0)+1);
  const nextForeignGoods=(foreignGoods[currency]||0)+foreignAmount;if(!Number.isFinite(nextForeignGoods))throw new Error("جمع مبلغ ارزی محموله‌ها معتبر نیست");foreignGoods[currency]=nextForeignGoods;
  const productKey=String(s.productId??s.productName??"unknown"),product=byProduct.get(productKey)||{productId:s.productId??null,productName:s.productName||"بدون نام",shipments:0,weight:0,landedCost:0};
  product.shipments++;product.weight+=weight;product.landedCost+=totalCost;byProduct.set(productKey,product);
  const supplierKey=String(s.supplierId??s.supplierName??"unknown"),supplier=bySupplier.get(supplierKey)||{supplierId:s.supplierId??null,supplierName:s.supplierName||"بدون نام",shipments:0,weight:0,landedCost:0};
  supplier.shipments++;supplier.weight+=weight;supplier.landedCost+=totalCost;bySupplier.set(supplierKey,supplier);
  return {...s,goodsRial,ancillary,totalCost,unitCost};
 });
 for(const n of [totalGoodsRial,totalAncillary,totalLanded,receivedCost])if(!Number.isSafeInteger(n))throw new Error("جمع بهای محموله‌ها از محدوده عددی مجاز خارج است");
 for(const n of [totalWeight,receivedWeight,inTransitWeight])if(!Number.isFinite(n))throw new Error("جمع وزن محموله‌ها از محدوده عددی مجاز خارج است");
 for(const [currency,amount] of Object.entries(foreignGoods))if(!Number.isSafeInteger(amount))throw new Error("جمع مبلغ ارزی "+currency+" معتبر نیست");
 const productRows=[...byProduct.values()].map(x=>({...x,averageUnitCost:x.weight?x.landedCost/x.weight:0})).sort((a,b)=>b.landedCost-a.landedCost);
 const supplierRows=[...bySupplier.values()].map(x=>({...x,averageUnitCost:x.weight?x.landedCost/x.weight:0})).sort((a,b)=>b.landedCost-a.landedCost);
 return {count:rows.length,totalWeight,totalGoodsRial,totalAncillary,totalLanded,weightedUnitCost:totalWeight?totalLanded/totalWeight:0,receivedWeight,receivedCost,inTransitWeight,statusCounts:Object.fromEntries(statusCounts),foreignGoods,productRows,supplierRows,rows:rows.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))};
}
if(typeof module!=="undefined"&&module.exports)module.exports={summarizeImportShipments};
