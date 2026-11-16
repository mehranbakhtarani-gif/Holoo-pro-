const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("warehouse transfers use one guarded transaction for stock rows and lot snapshots",()=>{
 assert.match(app,/function putManyGuarded\(entries,guards=\[\]\)/);
 assert.match(app,/موجودی یا بچ انبار هم‌زمان تغییر کرده است/);
 const start=app.indexOf('if(page==="warehouseTransfers")');
 const end=app.indexOf('\nif(page==="warehouses")',start);
 const body=app.slice(start,end);
 assert.ok(body.includes("putManyGuarded("));
 assert.ok(body.includes('store:"warehouseStock"'));
 assert.ok(body.includes('store:"inventoryLots"'));
 assert.ok(body.includes('store:"warehouseTransfers",match:{number:transferNumber},expected:null'));
});

test("warehouses cannot be deleted while stock, lots, shipments or documents reference them",()=>{
 assert.match(app,/حداقل یک انبار باید در دفتر باقی بماند/);
 assert.match(app,/stock\.some\(x=>Number\(x\.warehouseId\)===key\)/);
 assert.match(app,/transfers\.some\(x=>Number\(x\.sourceWarehouseId\)===key\|\|Number\(x\.destinationWarehouseId\)===key\)/);
});

test("warehouse and transfer history lists can be searched",()=>{
 assert.match(app,/جست‌وجوی نام انبار، نشانی یا مسئول/);
 assert.match(app,/جست‌وجوی کالا، انبار مبدأ یا مقصد/);
});
