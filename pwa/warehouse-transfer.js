function calculateWarehouseTransfer(input){
 const product=input.product||{},source=input.source||{},destination=input.destination||{};
 const qty=Number(input.quantity),sourceRows=input.sourceRows||[],destinationRows=input.destinationRows||[];
 if(!source.id||!destination.id||Number(source.id)===Number(destination.id))throw new Error("انبار مبدأ و مقصد باید متفاوت و معتبر باشند");
 if(!Number.isFinite(qty)||qty<=0)throw new Error("مقدار انتقال باید مثبت باشد");
 const src=sourceRows.find(x=>Number(x.productId)===Number(product.id)&&Number(x.warehouseId)===Number(source.id));
 const dst=destinationRows.find(x=>Number(x.productId)===Number(product.id)&&Number(x.warehouseId)===Number(destination.id));
 if(sourceRows.filter(x=>Number(x.productId)===Number(product.id)&&Number(x.warehouseId)===Number(source.id)).length>1)throw new Error("موجودی مبدأ تکراری است");
 if(destinationRows.filter(x=>Number(x.productId)===Number(product.id)&&Number(x.warehouseId)===Number(destination.id)).length>1)throw new Error("موجودی مقصد تکراری است");
 const srcStock=Number(src?.stock||0),srcValue=Number(src?.value||0),dstStock=Number(dst?.stock||0),dstValue=Number(dst?.value||0);
 if(srcStock+1e-9<qty)throw new Error("موجودی انبار مبدأ کافی نیست");
 if(!Number.isSafeInteger(srcValue)||srcValue<0||!Number.isFinite(dstStock)||dstStock<0||!Number.isSafeInteger(dstValue)||dstValue<0)throw new Error("ارزش یا مقدار موجودی انبار نامعتبر است");
 const movedValue=qty>=srcStock-1e-9?srcValue:Math.round(qty*(srcValue/srcStock));
 if(!Number.isSafeInteger(movedValue)||movedValue<0||!Number.isSafeInteger(dstValue+movedValue))throw new Error("ارزش انتقال خارج از محدوده مجاز است");
 const nextSourceStock=qty>=srcStock-1e-9?0:srcStock-qty,nextSourceValue=qty>=srcStock-1e-9?0:srcValue-movedValue;
 const sourceRecord={...(src||{}),productId:product.id,productName:product.name,warehouseId:Number(source.id),stock:nextSourceStock,value:nextSourceValue,average:nextSourceStock>0?nextSourceValue/nextSourceStock:0,updatedAt:Date.now()};
 const destinationRecord={...(dst||{}),productId:product.id,productName:product.name,warehouseId:Number(destination.id),stock:dstStock+qty,value:dstValue+movedValue,average:(dstValue+movedValue)/(dstStock+qty),updatedAt:Date.now()};
 return {sourceRecord,destinationRecord,quantity:qty,value:movedValue};
}
if(typeof module!=="undefined"&&module.exports)module.exports={calculateWarehouseTransfer};
