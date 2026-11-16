const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("inventory search covers product identifiers, yarn attributes and denier",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/x\.sku,x\.name,x\.group,x\.yarn,x\.color,x\.denier/);
 assert.match(app,/toLocaleLowerCase\("fa"\)/);
 assert.match(app,/جست‌وجوی کد، نام، گروه، نوع نخ، دنیر یا رنگ/);
});

test("inventory price labels follow the selected display unit and show average cost",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/بهای میانگین هر کیلو \("\+moneyUnit\(\)\)/);
 assert.match(app,/قیمت سطح ۱ \("\+moneyUnit\(\)\)/);
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
