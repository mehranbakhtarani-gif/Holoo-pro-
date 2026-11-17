function calculateWarehouseTransfer(input){
 const product=input.product||{},source=input.source||{},destination=input.destination||{};
 const productId=Number(product.id),sourceId=Number(source.id),destinationId=Number(destination.id);
 const qty=Number(input.quantity),sourceRows=input.sourceRows||[],destinationRows=input.destinationRows||[];
 if(!Number.isSafeInteger(productId)||productId<=0)throw new Error("کالای معتبر انتخاب کنید");
 if(!Number.isSafeInteger(sourceId)||sourceId<=0||!Number.isSafeInteger(destinationId)||destinationId<=0||sourceId===destinationId)throw new Error("انبار مبدأ و مقصد باید متفاوت و معتبر باشند");
 if(!Number.isFinite(qty)||qty<=0)throw new Error("مقدار انتقال باید مثبت باشد");
 const sourceMatches=sourceRows.filter(x=>Number(x.productId)===productId&&Number(x.warehouseId)===sourceId);
 const destinationMatches=destinationRows.filter(x=>Number(x.productId)===productId&&Number(x.warehouseId)===destinationId);
 if(sourceMatches.length>1)throw new Error("موجودی مبدأ تکراری است");
 if(destinationMatches.length>1)throw new Error("موجودی مقصد تکراری است");
 const src=sourceMatches[0],dst=destinationMatches[0];
 const hasProductStockRows=[...sourceRows,...destinationRows].some(row=>Number(row.productId)===productId);
 const srcStock=Number(src?.stock??(hasProductStockRows?0:product.stock)||0),srcValue=Number(src?.value??(hasProductStockRows?0:product.value)||0),dstStock=Number(dst?.stock||0),dstValue=Number(dst?.value||0);
 if(!Number.isFinite(srcStock)||srcStock<0||!Number.isFinite(dstStock)||dstStock<0||!Number.isSafeInteger(srcValue)||srcValue<0||!Number.isSafeInteger(dstValue)||dstValue<0)throw new Error("ارزش یا مقدار موجودی انبار نامعتبر است");
 if(srcStock+1e-9<qty)throw new Error("موجودی انبار مبدأ کافی نیست");
 const movedValue=qty>=srcStock-1e-9?srcValue:Math.round(qty*(srcValue/srcStock));
 if(!Number.isSafeInteger(movedValue)||movedValue<0||!Number.isSafeInteger(dstValue+movedValue))throw new Error("ارزش انتقال خارج از محدوده مجاز است");
 const nextSourceStock=qty>=srcStock-1e-9?0:srcStock-qty,nextSourceValue=qty>=srcStock-1e-9?0:srcValue-movedValue;
 const nextDestinationStock=dstStock+qty,nextDestinationValue=dstValue+movedValue;
 if(!Number.isFinite(nextDestinationStock)||!Number.isSafeInteger(nextDestinationValue))throw new Error("مانده انبار مقصد خارج از محدوده مجاز است");
 const sourceRecord={...(src||{}),productId:product.id,productName:product.name,warehouseId:sourceId,stock:nextSourceStock,value:nextSourceValue,average:nextSourceStock>0?nextSourceValue/nextSourceStock:0,updatedAt:Date.now()};
 const destinationRecord={...(dst||{}),productId:product.id,productName:product.name,warehouseId:destinationId,stock:nextDestinationStock,value:nextDestinationValue,average:nextDestinationValue/nextDestinationStock,updatedAt:Date.now()};
 return {sourceRecord,destinationRecord,quantity:qty,value:movedValue};
}
if(typeof module!=="undefined"&&module.exports)module.exports={calculateWarehouseTransfer};
