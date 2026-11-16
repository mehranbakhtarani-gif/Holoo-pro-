const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("inventory search covers product identifiers, yarn attributes and denier",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/x\.sku,x\.barcode,x\.name,x\.group,x\.yarn,x\.color,x\.denier/);
 assert.match(app,/toLocaleLowerCase\("fa"\)/);
 assert.match(app,/جست‌وجوی کد، بارکد، نام، گروه، نوع نخ، دنیر یا رنگ/);
});

test("inventory price labels follow the selected display unit and show average cost",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.ok(app.includes('بهای میانگین هر کیلو ("+moneyUnit()+")'));
 assert.ok(app.includes('قیمت سطح ۱ ("+moneyUnit()+")'));
 assert.match(app,/money\(x\.avg\|\|0\)/);
});


test("live search rerender preserves keyboard focus and caret position",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const start=s\.selectionStart,end=s\.selectionEnd;render\(\)\.then\(\(\)=>\{const next=\$\("#search"\);if\(next\)\{next\.focus\(\);if\(start!==null&&end!==null\)next\.setSelectionRange\(start,end\)\}\}\)/);
});


test("edit and delete action failures are shown without unhandled rejections",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/function edit\(s,id\).*\.catch\(e=>toast\(e\.message\|\|"فرم ویرایش باز نشد"\)\)/);
 assert.match(app,/\[data-del\].*removeRow\(\.\.\.b\.dataset\.del\.split\(":"\)\)\.catch\(e=>toast\(e\.message\|\|"حذف ناموفق بود"\)\)/);
});


test("products referenced by pending shipments, sales orders, lots or transfers cannot be deleted",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/all\("importShipments"\).*all\("salesOrders"\).*all\("inventoryLots"\).*all\("warehouseTransfers"\)/);
 assert.match(app,/hasShipment\|\|hasOrder\|\|hasLot\|\|hasTransfer\|\|hasWarehouseStock/);
});

 
test("inventory supports unique barcodes and minimum-stock alerts",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.ok(app.includes('["barcode","بارکد","text"]'));
 assert.match(app,/جست‌وجوی کد، بارکد، نام/);
 assert.ok(app.includes('["minStock","حداقل موجودی هشدار (کیلوگرم)","number"]'));
 assert.match(app,/if\(v\.barcode&&a\.some\(x=>x\.barcode===v\.barcode&&x\.id!==v\.id\)\)throw Error\("بارکد تکراری است"\)/);
 assert.match(app,/Number\(x\.stock\|\|0\)<=Number\(x\.minStock\)/);
 assert.match(app,/حداقل تعیین نشده/);
});

 
test("party edits preserve opening balance and cannot reclassify parties with history",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/balance:item\?Number\(item\.balance\|\|0\):num\("balance"\)/);
 assert.match(app,/balanceField\.readOnly=true/);
 assert.match(app,/hasHistory&&kind!==item\.kind/);
});

test("party deletion checks orders, import shipments and foreign payable links",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/all\("salesOrders"\).*all\("importShipments"\).*all\("foreignPayables"\).*all\("foreignPayablePayments"\)/);
});

 
test("party statements display opening balance before dated movements",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const opening=Number\(party\.balance\|\|0\)-movement/);
 assert.match(app,/مانده افتتاحیه/);
 assert.match(app,/money\(Math\.abs\(balance\)\)/);
});
