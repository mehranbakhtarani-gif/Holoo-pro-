const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
const start=app.indexOf("async function adjustStockPwa");
const end=app.indexOf("\nasync function receiveImportShipment",start);
const body=app.slice(start,end);

test("stock adjustments require an explicit warehouse when more than one exists",()=>{
 assert.match(body,/all\("warehouses"\)/);
 assert.match(body,/شناسه انبار مقصد اصلاح/);
 assert.match(body,/warehouse=warehouses\.find/);
});

test("positive stock adjustments update product, warehouse stock and create a traceable lot",()=>{
 assert.match(body,/direction:"PURCHASE",lineTotal:adjustmentValue/);
 assert.match(body,/sourceType:"STOCK_ADJUSTMENT"/);
 assert.match(body,/\["warehouseStock",movement\.record\]/);
 assert.match(body,/\["inventoryLots",lot\]/);
});

test("negative stock adjustments use FIFO lot costing and update warehouse valuation",()=>{
 assert.match(body,/planLotSale\(/);
 assert.match(body,/movement\.record\.stock=sale\.remainingStock/);
 assert.match(body,/movement\.record\.value=sale\.remainingValue/);
 assert.match(body,/sale\.newLots,\.\.\.sale\.updates/);
});

test("stock adjustment and its inventory, lot and accounting records post atomically",()=>{
 assert.match(body,/postVoucherAtomic\(\[\["products",product\],\["warehouseStock",movement\.record\],\["stockAdjustments",adjustment\],\.\.\.lotEntries\]/);
 assert.match(body,/STOCK_ADJUSTMENT:/);
});
