function calculateWarehouseStockMovement(input){
 const product=input.product||{},rows=input.warehouseRows||[],warehouseId=Number(input.warehouseId);
 const productId=Number(product.id),qty=Number(input.quantity),direction=input.direction,lineTotal=Number(input.lineTotal||0);
 if(!Number.isSafeInteger(productId)||productId<=0)throw new Error("کالای معتبر انتخاب کنید");
 if(!Number.isSafeInteger(warehouseId)||warehouseId<=0)throw new Error("انبار معتبر انتخاب کنید");
 if(!Number.isFinite(qty)||qty<=0)throw new Error("مقدار کالا باید مثبت باشد");
 if(!["PURCHASE","SALE"].includes(direction))throw new Error("نوع گردش انبار معتبر نیست");
 const matches=rows.filter(row=>Number(row.productId)===productId&&Number(row.warehouseId)===warehouseId);
 if(matches.length>1)throw new Error("برای این کالا در انبار، رکورد موجودی تکراری وجود دارد");
 const legacy=rows.some(row=>Number(row.productId)===productId);
 const current=matches[0]||{productId:product.id,warehouseId,stock:legacy?0:Number(product.stock||0),value:legacy?0:Number(product.value||0)};
 const stock=Number(current.stock||0),value=Number(current.value||0);
 if(!Number.isFinite(stock)||stock<0||!Number.isSafeInteger(value)||value<0)throw new Error("موجودی یا ارزش انبار نامعتبر است");
 let nextStock,nextValue,cogs=0;
 if(direction==="PURCHASE"){
  if(!Number.isSafeInteger(lineTotal)||lineTotal<=0)throw new Error("بهای خرید ردیف معتبر نیست");
  nextStock=stock+qty;nextValue=value+lineTotal;
 }else{
  if(stock+1e-9<qty)throw new Error("موجودی کالا در انبار انتخاب‌شده کافی نیست");
  if(!(stock>0))throw new Error("موجودی انبار برای خروج معتبر نیست");
  cogs=qty>=stock-1e-9?value:Math.round(qty*(value/stock));
  if(!Number.isSafeInteger(cogs)||cogs<0||cogs>value)throw new Error("بهای خروج از انبار معتبر نیست");
  nextStock=qty>=stock-1e-9?0:stock-qty;
  nextValue=qty>=stock-1e-9?0:value-cogs;
 }
 if(!Number.isFinite(nextStock)||nextStock<0||!Number.isSafeInteger(nextValue)||nextValue<0)throw new Error("مانده جدید انبار خارج از محدوده مجاز است");
 const record={...current,productId:product.id,productName:product.name,warehouseId,stock:nextStock,value:nextValue,average:nextStock>0?nextValue/nextStock:0,updatedAt:Date.now()};
 return {record,cogs,stock:nextStock,value:nextValue,average:record.average,isNew:!current.id};
}
if(typeof module!=="undefined"&&module.exports)module.exports={calculateWarehouseStockMovement};
