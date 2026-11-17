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
 assert.ok(body.includes('store:"warehouses",key:Number(source.id)'));
 assert.ok(body.includes('store:"warehouses",key:Number(destination.id)'));
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

 
test("warehouse page exposes per-product stock, average cost and inventory value",()=>{
 assert.match(app,/ریز موجودی کالاها در/);
 assert.match(app,/بهای میانگین هر kg/);
 assert.match(app,/money\(x\.average\|\|0\)/);
});
test("warehouse page exports a Persian-compatible CSV stock valuation report",()=>{
 assert.match(app,/id="exportWarehouseStockCsv"/);
 assert.match(app,/holloo-warehouse-stock\.csv/);
 assert.match(app,/بهای میانگین ریال/);
 assert.match(app,/ارزش موجودی ریال/);
 assert.match(app,/\\uFEFF/);
});


test("warehouse transfer history exports quantity, source, destination and value",()=>{
 assert.match(app,/id="exportWarehouseTransfersCsv"/);
 assert.match(app,/holloo-warehouse-transfers\.csv/);
 assert.match(app,/ارزش منتقل‌شده ریال/);
});

 
test("warehouse names are normalized and checked atomically on create and edit",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/function putWarehouseUnique\(record\)/);
 assert.match(app,/db\.transaction\(\["warehouses","auditLog"\],"readwrite"\)/);
 assert.ok(app.includes('toLocaleLowerCase("fa")===normalized'));
 assert.match(app,/await putWarehouseUnique\(\{id:item\?\.id,name,address/);
});

test("stocktake adjustments retain a source link and use guarded atomic voucher posting",()=>{
 const start=app.indexOf("async function adjustStockPwa"),end=app.indexOf("\\nasync function receiveImportShipment",start),body=app.slice(start,end);
 assert.match(body,/stocktakeId:Number\(options\.stocktakeId\)/);
 assert.match(body,/expectedProductState/);
 assert.match(body,/currentWarehouseState/);
 assert.match(body,/postVoucherAtomic\(/);
 assert.match(body,/STOCK_ADJUSTMENT:/);
});

test("warehouse transfer reversal is exposed and restores FIFO provenance in one guarded write",()=>{
 assert.match(app,/async function reverseWarehouseTransferPwa\(number\)/);
 assert.match(app,/planLotTransferReversal\(\{transfer,lots/);
 assert.match(app,/warehouse-transfer-reverse/);
 assert.match(app,/WAREHOUSE_TRANSFER_REVERSAL:/);
 assert.match(app,/store:"warehouseTransfers",key:Number\(transfer\.id\),expected:\{\.\.\.transfer\}/);
 assert.match(app,/destinationLotUpdates\.map\(lot=>\["inventoryLots",lot\]\)/);
 assert.match(app,/putManyGuarded\(entries,guards\)/);
});
