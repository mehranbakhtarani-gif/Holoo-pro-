const test=require("node:test");
const assert=require("node:assert/strict");
const {planLotReceipt,planLotSale,restoreLotSale,summarizeLotProfit}=require("../inventory-lots.js");
const receipt=(id,qty,cost,date,sourceType="IMPORT_SHIPMENT")=>planLotReceipt({productId:1,productName:"FDY سفید 60D",warehouseId:2,sourceType,sourceId:id,sourceNumber:id,container:"C-"+id,supplierName:"Supplier",quantity:qty,totalCost:cost,receivedAt:date});
test("creates immutable source metadata and full-cost lot for an inbound shipment",()=>{
 const lot=receipt("CN-1",100,125000,100);
 assert.equal(lot.originalQty,100);assert.equal(lot.remainingQty,100);
 assert.equal(lot.originalCost,125000);assert.equal(lot.unitCost,1250);
 assert.equal(lot.sourceNumber,"CN-1");assert.equal(lot.container,"C-CN-1");
});
test("consumes lots FIFO and calculates exact layer COGS",()=>{
 const first=receipt("CN-1",100,125000,100),second=receipt("CN-2",100,160000,200);
 const result=planLotSale({productId:1,productName:"FDY سفید 60D",warehouseId:2,quantity:120,warehouseStock:{stock:200,value:285000},lots:[first,second],date:300});
 assert.equal(result.cogs,157000);
 assert.deepEqual(result.allocations.map(x=>[x.sourceNumber,x.quantity,x.cogs]),[["CN-1",100,125000],["CN-2",20,32000]]);
 assert.equal(result.remainingStock,80);assert.equal(result.remainingValue,128000);
});
test("creates a legacy opening layer for stock that predates lot tracking",()=>{
 const result=planLotSale({productId:1,productName:"FDY",warehouseId:2,quantity:2,warehouseStock:{stock:10,value:10000},lots:[]});
 assert.equal(result.cogs,2000);assert.equal(result.allocations[0].sourceType,"LEGACY");
 assert.equal(result.remainingStock,8);assert.equal(result.remainingValue,8000);
 assert.equal(result.newLots.length,1);
});
test("restores sold quantities and cost to their original source lots",()=>{
 const lot=receipt("CN-1",100,125000,100);
 const sold=planLotSale({productId:1,productName:"FDY",warehouseId:2,quantity:10,warehouseStock:{stock:100,value:125000},lots:[lot]});
 const restored=restoreLotSale({lots:[...sold.newLots,...sold.updates],allocations:sold.allocations,date:400});
 assert.equal(restored[0].remainingQty,100);assert.equal(restored[0].remainingValue,125000);
});
test("reports revenue and gross profit by original shipment without counting reversed invoices",()=>{
 const lot=receipt("CN-1",100,125000,100);
 const sold=planLotSale({productId:1,productName:"FDY",warehouseId:2,quantity:10,warehouseStock:{stock:100,value:125000},lots:[lot]});
 const rows=summarizeLotProfit({lots:[...sold.newLots,...sold.updates],invoices:[{kind:"SALE",status:"POSTED",lines:[{qty:10,totalQty:10,lineTotal:20000,lotAllocations:sold.allocations}]},{kind:"SALE",status:"REVERSED",lines:[{qty:10,totalQty:10,lineTotal:20000,lotAllocations:sold.allocations}]}]});
 assert.equal(rows.length,1);assert.equal(rows[0].soldQty,10);assert.equal(rows[0].soldCost,12500);assert.equal(rows[0].revenue,20000);assert.equal(rows[0].grossProfit,7500);
});
test("rejects aggregate-to-lot discrepancies and missing sale allocations on return",()=>{
 const lot=receipt("CN-1",100,125000,100);
 assert.throws(()=>planLotSale({productId:1,warehouseId:2,quantity:1,warehouseStock:{stock:90,value:110000},lots:[lot]}),/مغایرت/);
 assert.throws(()=>restoreLotSale({lots:[lot],allocations:[]}),/موجود نیست/);
});

test("PWA integrates FIFO lots with database, shipment receipt, invoice sales and reversals",()=>{
 const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"..");
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8"),html=fs.readFileSync(path.join(root,"index.html"),"utf8"),sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.match(app,/DB_VERSION=10/);assert.match(app,/"inventoryLots"/);
 assert.match(html,/inventory-lots\.js\?v=inventory-lots-1/);
 assert.ok(html.indexOf("inventory-lots.js")<html.indexOf("app.js?v=inventory-lots-1"));
 assert.match(sw,/\.\/inventory-lots\.js/);assert.match(sw,/inventory-lots\\.js/);
 assert.match(app,/sourceType:"IMPORT_SHIPMENT"/);assert.match(app,/sourceType:"PURCHASE_INVOICE"/);
 assert.match(app,/planLotSale\(/);assert.match(app,/lotAllocations/);assert.match(app,/restoreLotSale\(/);
 assert.match(app,/summarizeLotProfit\(/);assert.match(app,/سود ناخالص کانتینرها/);
});
