const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateWarehouseStockMovement } = require("../warehouse-stock.js");
const { calculateWarehouseTransfer } = require("../warehouse-transfer.js");

test("migrates legacy stock into the first warehouse without losing value", () => {
 const result=calculateWarehouseStockMovement({product:{id:4,name:"FDY",stock:100,value:50000},warehouseId:1,warehouseRows:[],quantity:10,direction:"SALE"});
 assert.equal(result.cogs,5000);assert.equal(result.stock,90);assert.equal(result.value,45000);assert.equal(result.record.warehouseId,1);
});

test("keeps warehouse balances independent and uses the selected warehouse average cost", () => {
 const rows=[{id:9,productId:4,warehouseId:3,stock:10,value:30000}];
 const result=calculateWarehouseStockMovement({product:{id:4,name:"FDY",stock:80,value:80000},warehouseId:3,warehouseRows:rows,quantity:2,direction:"SALE"});
 assert.equal(result.cogs,6000);assert.equal(result.stock,8);assert.equal(result.value,24000);
 const other=calculateWarehouseStockMovement({product:{id:4,name:"FDY",stock:80,value:80000},warehouseId:2,warehouseRows:rows,quantity:5,direction:"PURCHASE",lineTotal:4000});
 assert.equal(other.stock,5);assert.equal(other.value,4000);
});

test("rejects overselling and duplicate stock records", () => {
 const product={id:4,name:"FDY",stock:20,value:10000};
 assert.throws(()=>calculateWarehouseStockMovement({product,warehouseId:1,warehouseRows:[{productId:4,warehouseId:1,stock:4,value:2000}],quantity:5,direction:"SALE"}));
 assert.throws(()=>calculateWarehouseStockMovement({product,warehouseId:1,warehouseRows:[{productId:4,warehouseId:1,stock:4,value:2000},{productId:4,warehouseId:1,stock:4,value:2000}],quantity:1,direction:"SALE"}));
});

test("transfers stock and book value without changing company totals", () => {
 const result=calculateWarehouseTransfer({product:{id:8,name:"FDY"},source:{id:1},destination:{id:2},quantity:4,sourceRows:[{id:11,productId:8,warehouseId:1,stock:10,value:30000}],destinationRows:[{id:12,productId:8,warehouseId:2,stock:2,value:5000}]});
 assert.equal(result.quantity,4);assert.equal(result.value,12000);
 assert.equal(result.sourceRecord.stock,6);assert.equal(result.sourceRecord.value,18000);
 assert.equal(result.destinationRecord.stock,6);assert.equal(result.destinationRecord.value,17000);
 assert.equal(result.sourceRecord.value+result.destinationRecord.value,35000);
});

test("rejects same-warehouse, overdrawn, duplicate and malformed transfers", () => {
 const base={product:{id:8,name:"FDY"},source:{id:1},destination:{id:2},quantity:5,sourceRows:[{id:11,productId:8,warehouseId:1,stock:4,value:12000}],destinationRows:[]};
 assert.throws(()=>calculateWarehouseTransfer({...base,destination:{id:1}}));
 assert.throws(()=>calculateWarehouseTransfer(base));
 assert.throws(()=>calculateWarehouseTransfer({...base,sourceRows:[...base.sourceRows,...base.sourceRows]}));
 assert.throws(()=>calculateWarehouseTransfer({...base,sourceRows:[{productId:8,warehouseId:1,stock:4,value:1.5}]}));
});

const fs = require("node:fs");
const path = require("node:path");
test("PWA wires warehouse core into invoice and transfer workflows", () => {
 const root=path.resolve(__dirname,"..");
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.match(app,/DB_VERSION=11/);
 assert.match(app,/"warehouseTransfers"/);
 assert.match(app,/calculateWarehouseStockMovement\(/);
 assert.match(app,/calculateWarehouseTransfer\(/);
 assert.match(app,/name="warehouseId"/);
 assert.ok(html.indexOf("warehouse-stock.js") < html.indexOf("app.js"));
 assert.ok(html.indexOf("warehouse-transfer.js") < html.indexOf("app.js"));
 assert.match(sw,/\.\/warehouse-stock\.js/);
 assert.match(sw,/\.\/warehouse-transfer\.js/);
});

test("transfers legacy product stock when no per-warehouse stock rows exist yet",()=>{
 const result=calculateWarehouseTransfer({product:{id:9,name:"FDY",stock:10,value:25000},source:{id:1},destination:{id:2},quantity:4,sourceRows:[],destinationRows:[]});
 assert.equal(result.sourceRecord.stock,6);
 assert.equal(result.sourceRecord.value,15000);
 assert.equal(result.destinationRecord.stock,4);
 assert.equal(result.destinationRecord.value,10000);
 assert.equal(result.sourceRecord.value+result.destinationRecord.value,25000);
});
test("does not treat stock in another warehouse as legacy stock for an empty source warehouse",()=>{
 const result=calculateWarehouseTransfer({product:{id:9,name:"FDY",stock:10,value:25000},source:{id:1},destination:{id:2},quantity:1,sourceRows:[{productId:9,warehouseId:3,stock:10,value:25000}],destinationRows:[{productId:9,warehouseId:3,stock:10,value:25000}]});
 assert.throws(()=>calculateWarehouseTransfer({product:{id:9,name:"FDY",stock:10,value:25000},source:{id:1},destination:{id:2},quantity:1,sourceRows:[{productId:9,warehouseId:3,stock:10,value:25000}],destinationRows:[{productId:9,warehouseId:3,stock:10,value:25000}]}),/موجودی انبار مبدأ کافی نیست/);
});
