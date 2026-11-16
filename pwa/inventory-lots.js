function planLotReceipt(input){
 const qty=Number(input.quantity),cost=Number(input.totalCost),productId=Number(input.productId),warehouseId=Number(input.warehouseId);
 if(!Number.isSafeInteger(productId)||productId<=0||!Number.isSafeInteger(warehouseId)||warehouseId<=0)throw new Error("کالا و انبار برای ثبت بچ معتبر نیست");
 if(!Number.isFinite(qty)||qty<=0||!Number.isSafeInteger(cost)||cost<0)throw new Error("مقدار یا بهای بچ ورودی معتبر نیست");
 const sourceType=String(input.sourceType||""),sourceId=String(input.sourceId??"");
 if(!["IMPORT_SHIPMENT","PURCHASE_INVOICE","STOCK_ADJUSTMENT","WAREHOUSE_TRANSFER","LEGACY"].includes(sourceType)||!sourceId)throw new Error("منبع بچ موجودی معتبر نیست");
 const id=String(input.id||("LOT:"+sourceType+":"+sourceId+":"+productId+":"+warehouseId+":"+(input.lineIndex??0)));
 const lot={id,productId,productName:String(input.productName||""),warehouseId,sourceType,sourceId,sourceNumber:String(input.sourceNumber||sourceId),sourceLineIndex:Number(input.lineIndex||0),container:String(input.container||""),supplierId:input.supplierId??null,supplierName:String(input.supplierName||""),receivedAt:Number(input.receivedAt||Date.now()),originalQty:qty,remainingQty:qty,originalCost:cost,remainingValue:cost,unitCost:cost/qty,status:"OPEN"};
 return lot;
}
function planLotSale(input){
 const productId=Number(input.productId),warehouseId=Number(input.warehouseId),quantity=Number(input.quantity),lots=Array.isArray(input.lots)?input.lots:[];
 const stock=input.warehouseStock||{},stockQty=Number(stock.stock),stockValue=Number(stock.value);
 if(!Number.isSafeInteger(productId)||productId<=0||!Number.isSafeInteger(warehouseId)||warehouseId<=0||!Number.isFinite(quantity)||quantity<=0)throw new Error("اطلاعات خروج بچ معتبر نیست");
 if(!Number.isFinite(stockQty)||stockQty<0||!Number.isSafeInteger(stockValue)||stockValue<0||stockQty+1e-9<quantity)throw new Error("موجودی انبار برای خروج بچ کافی یا معتبر نیست");
 const matching=lots.filter(x=>Number(x.productId)===productId&&Number(x.warehouseId)===warehouseId&&Number(x.remainingQty)>1e-9);
 let trackedQty=matching.reduce((n,x)=>n+Number(x.remainingQty),0),trackedValue=matching.reduce((n,x)=>n+Number(x.remainingValue),0);
 if(trackedQty>stockQty+1e-6||trackedValue>stockValue+1)throw new Error("موجودی بچ‌ها با موجودی کل انبار مغایرت دارد؛ ابتدا مغایرت‌گیری کنید");
 const updates=[],newLots=[];
 const legacyQty=stockQty-trackedQty,legacyValue=stockValue-trackedValue;
 if(legacyQty>1e-6){
  const legacyId="LOT:LEGACY:"+productId+":"+warehouseId;
  const old=matching.find(x=>x.id===legacyId)||lots.find(x=>x.id===legacyId);
  const legacy=old?{...old,remainingQty:legacyQty,remainingValue:legacyValue,originalQty:Math.max(Number(old.originalQty||0),legacyQty),originalCost:Math.max(Number(old.originalCost||0),legacyValue)}:planLotReceipt({id:legacyId,productId,productName:input.productName,warehouseId,sourceType:"LEGACY",sourceId:legacyId,sourceNumber:"موجودی افتتاحیه / قدیمی",quantity:legacyQty,totalCost:legacyValue,receivedAt:0});
  (old?updates:newLots).push(legacy);matching.push(legacy);trackedQty+=legacyQty;trackedValue+=legacyValue;
 }else if(legacyQty<-1e-6||Math.abs(legacyValue-stockValue+trackedValue)>1)throw new Error("مانده بچ‌های انبار با موجودی دفتر کل برابر نیست");
 let remaining=quantity,cogs=0;const allocations=[];
 const ordered=matching.slice().sort((a,b)=>Number(a.receivedAt||0)-Number(b.receivedAt||0)||String(a.id).localeCompare(String(b.id)));
 for(const lot of ordered){
  if(remaining<=1e-9)break;
  const lotQty=Number(lot.remainingQty),lotValue=Number(lot.remainingValue);
  if(!Number.isFinite(lotQty)||lotQty<=0||!Number.isSafeInteger(lotValue)||lotValue<0)throw new Error("اطلاعات مانده یک بچ معتبر نیست");
  const take=Math.min(remaining,lotQty),cost=take>=lotQty-1e-9?lotValue:Math.round(take*lotValue/lotQty);
  if(!Number.isSafeInteger(cost)||cost<0||cost>lotValue)throw new Error("بهای خروج بچ معتبر نیست");
  const updated={...lot,remainingQty:take>=lotQty-1e-9?0:lotQty-take,remainingValue:lotValue-cost,status:take>=lotQty-1e-9?"CLOSED":"OPEN",updatedAt:Number(input.date||Date.now())};
  const existing=updates.findIndex(x=>x.id===updated.id),newIndex=newLots.findIndex(x=>x.id===updated.id);if(existing>=0)updates[existing]=updated;else if(newIndex>=0)newLots[newIndex]=updated;else updates.push(updated);
  allocations.push({lotId:lot.id,originLotId:lot.originLotId||lot.id,sourceType:lot.sourceType,sourceId:lot.sourceId,sourceNumber:lot.sourceNumber,container:lot.container||"",quantity:take,cogs:cost});
  cogs+=cost;remaining-=take;
 }
 if(remaining>1e-6||!Number.isSafeInteger(cogs))throw new Error("بچ‌های قابل ردیابی برای مقدار خروج کافی نیستند");
 const remainingValue=stockValue-cogs,remainingStock=stockQty-quantity;
 if(!Number.isSafeInteger(remainingValue)||remainingValue<0||remainingStock< -1e-6)throw new Error("مانده ارزش موجودی پس از خروج معتبر نیست");
 return {cogs,allocations,updates,newLots,remainingStock:Math.max(0,remainingStock),remainingValue,average:remainingStock>1e-9?remainingValue/remainingStock:0};
}
function restoreLotSale(input){
 const lots=Array.isArray(input.lots)?input.lots:[],allocations=Array.isArray(input.allocations)?input.allocations:[];
 if(!allocations.length)throw new Error("جزئیات بچ‌های فاکتور برای برگشت موجود نیست");
 const grouped=new Map();
 for(const allocation of allocations){
  const lotId=String(allocation.lotId||""),qty=Number(allocation.quantity),cost=Number(allocation.cogs);
  if(!lotId||!Number.isFinite(qty)||qty<=0||!Number.isSafeInteger(cost)||cost<0)throw new Error("بچ مرجع برای برگشت فروش پیدا نشد");
  const row=grouped.get(lotId)||{quantity:0,cogs:0};
  row.quantity+=qty;row.cogs+=cost;
  if(!Number.isFinite(row.quantity)||!Number.isSafeInteger(row.cogs))throw new Error("جمع مقدار یا بهای برگشت بچ معتبر نیست");
  grouped.set(lotId,row);
 }
 const updates=[];
 for(const [lotId,allocation] of grouped){
  const lot=lots.find(x=>String(x.id)===lotId);
  if(!lot)throw new Error("بچ مرجع برای برگشت فروش پیدا نشد");
  const remainingQty=Number(lot.remainingQty||0)+allocation.quantity,remainingValue=Number(lot.remainingValue||0)+allocation.cogs;
  if(remainingQty>Number(lot.originalQty)+1e-6||remainingValue>Number(lot.originalCost)+1)throw new Error("برگشت بچ از مقدار/ارزش اولیه بیشتر می‌شود");
  updates.push({...lot,remainingQty,remainingValue,status:"OPEN",updatedAt:Number(input.date||Date.now())});
 }
 return updates;
}
function planLotTransfer(input){
 const sourceWarehouseId=Number(input.sourceWarehouseId),destinationWarehouseId=Number(input.destinationWarehouseId),quantity=Number(input.quantity),productId=Number(input.productId),date=Number(input.date||Date.now()),transferId=String(input.transferId||"");
 if(!transferId||sourceWarehouseId<=0||destinationWarehouseId<=0||sourceWarehouseId===destinationWarehouseId)throw new Error("اطلاعات انتقال بچ معتبر نیست");
 const sale=planLotSale({lots:input.lots,productId,productName:input.productName,warehouseId:sourceWarehouseId,quantity,warehouseStock:input.sourceWarehouseStock,date});
 const sourceLots=[...(input.lots||[]),...sale.newLots,...sale.updates],destinationLots=sale.allocations.map((allocation,index)=>{
  const source=sourceLots.find(x=>String(x.id)===String(allocation.lotId));
  if(!source)throw new Error("بچ مبدأ برای انتقال پیدا نشد");
  return {...source,id:"LOT:TRANSFER:"+transferId+":"+index,warehouseId:destinationWarehouseId,originalQty:allocation.quantity,remainingQty:allocation.quantity,originalCost:allocation.cogs,remainingValue:allocation.cogs,unitCost:allocation.quantity?allocation.cogs/allocation.quantity:0,receivedAt:date,originLotId:source.originLotId||source.id,transferredFromLotId:source.id,transferId,status:"OPEN",updatedAt:date};
 });
 const transferValue=sale.allocations.reduce((n,x)=>n+x.cogs,0);
 if(!Number.isSafeInteger(transferValue))throw new Error("ارزش بچ‌های انتقالی معتبر نیست");
 return {sourceLotUpdates:[...sale.newLots,...sale.updates],destinationLots,allocations:sale.allocations,quantity:sale.allocations.reduce((n,x)=>n+x.quantity,0),transferValue,sourceRemainingStock:sale.remainingStock,sourceRemainingValue:sale.remainingValue};
}
function summarizeLotProfit(input){
 const lots=Array.isArray(input.lots)?input.lots:[],invoices=Array.isArray(input.invoices)?input.invoices:[];
 const summaries=new Map(),lotById=new Map(lots.map(lot=>[String(lot.id),lot]));
 for(const lot of lots){
  if(!["IMPORT_SHIPMENT","PURCHASE_INVOICE"].includes(lot.sourceType)||lot.status==="REVERSED")continue;
  const rootId=String(lot.originLotId||lot.id),root=lotById.get(rootId)||lot;
  if(!summaries.has(rootId))summaries.set(rootId,{lotId:rootId,sourceType:root.sourceType,sourceNumber:root.sourceNumber,container:root.container||"",supplierName:root.supplierName||"",productName:root.productName||"",originalQty:Number(root.originalQty),originalCost:Number(root.originalCost),remainingQty:0,remainingValue:0,soldQty:0,soldCost:0,revenue:0,grossProfit:0});
  const row=summaries.get(rootId);row.remainingQty+=Number(lot.remainingQty||0);row.remainingValue+=Number(lot.remainingValue||0);
 }
 for(const invoice of invoices){
  if(invoice.kind!=="SALE"||invoice.status==="REVERSED")continue;
  for(const line of Array.isArray(invoice.lines)?invoice.lines:[]){
   const allocations=Array.isArray(line.lotAllocations)?line.lotAllocations:[];
   const qtyBase=Number(line.totalQty||line.qty||0),lineRevenue=Number(line.lineTotal||0);
   if(!Number.isFinite(qtyBase)||qtyBase<=0||!Number.isSafeInteger(lineRevenue)||lineRevenue<0)continue;
   let allocatedRevenue=0;
   allocations.forEach((allocation,index)=>{
    const revenue=index===allocations.length-1?lineRevenue-allocatedRevenue:Math.round(lineRevenue*Number(allocation.quantity)/qtyBase);
    allocatedRevenue+=revenue;
    const lot=lotById.get(String(allocation.lotId)),rootId=String(allocation.originLotId||lot?.originLotId||lot?.id||allocation.lotId),row=summaries.get(rootId);
    if(row)row.revenue+=revenue;
   });
  }
 }
 for(const row of summaries.values()){
  row.soldQty=Math.max(0,row.originalQty-row.remainingQty);row.soldCost=Math.max(0,row.originalCost-row.remainingValue);row.grossProfit=row.revenue-row.soldCost;
 }
 return [...summaries.values()].sort((a,b)=>b.grossProfit-a.grossProfit);
}
if(typeof module!=="undefined"&&module.exports)module.exports={planLotReceipt,planLotSale,planLotTransfer,restoreLotSale,summarizeLotProfit};
