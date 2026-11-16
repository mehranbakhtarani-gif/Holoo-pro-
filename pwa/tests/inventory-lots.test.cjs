const test=require("node:test");
const assert=require("node:assert/strict");
const {planLotReceipt,planLotSale,planLotTransfer,restoreLotSale,summarizeLotProfit}=require("../inventory-lots.js");
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


test("moves FIFO lots between warehouses without losing original shipment identity",()=>{
 const first=receipt("CN-1",100,125000,100),second=receipt("CN-2",100,160000,200);
 const transfer=planLotTransfer({lots:[first,second],productId:1,productName:"FDY سفید 60D",sourceWarehouseId:2,destinationWarehouseId:3,quantity:120,sourceWarehouseStock:{stock:200,value:285000},transferId:"WT-1",date:300});
 assert.equal(transfer.transferValue,157000);assert.equal(transfer.sourceRemainingStock,80);assert.equal(transfer.sourceRemainingValue,128000);
 assert.equal(transfer.destinationLots.length,2);
 assert.equal(transfer.destinationLots[0].sourceNumber,"CN-1");assert.equal(transfer.destinationLots[0].originLotId,first.id);
 assert.equal(transfer.destinationLots[0].warehouseId,3);
});
test("shipment profitability consolidates transferred stock and FIFO sales under the original container",()=>{
 const first=receipt("CN-1",100,125000,100),second=receipt("CN-2",100,160000,200);
 const transfer=planLotTransfer({lots:[first,second],productId:1,productName:"FDY سفید 60D",sourceWarehouseId:2,destinationWarehouseId:3,quantity:120,sourceWarehouseStock:{stock:200,value:285000},transferId:"WT-2",date:300});
 const destLots=transfer.destinationLots;
 const sale=planLotSale({productId:1,productName:"FDY سفید 60D",warehouseId:3,quantity:10,warehouseStock:{stock:120,value:157000},lots:destLots,date:400});
 const allLots=[...new Map([...transfer.sourceLotUpdates,...destLots,...sale.newLots,...sale.updates].map(lot=>[lot.id,lot])).values()];
 const rows=summarizeLotProfit({lots:allLots,invoices:[{kind:"SALE",status:"POSTED",lines:[{qty:10,totalQty:10,lineTotal:20000,lotAllocations:sale.allocations}]}]});
 const cn1=rows.find(x=>x.sourceNumber==="CN-1"),cn2=rows.find(x=>x.sourceNumber==="CN-2");
 assert.equal(rows.length,2);assert.equal(cn1.soldQty,10);assert.equal(cn1.remainingQty,90);assert.equal(cn1.soldCost,12500);assert.equal(cn1.revenue,20000);assert.equal(cn1.grossProfit,7500);
 assert.equal(cn2.soldQty,0);assert.equal(cn2.remainingQty,100);assert.equal(cn2.revenue,0);
});


test("does not assign legacy-stock revenue to a tracked container in mixed-source sales",()=>{
 const imported=receipt("CN-3",5,5000,100);
 const legacy=planLotReceipt({productId:1,productName:"FDY",warehouseId:2,sourceType:"LEGACY",sourceId:"legacy-1",sourceNumber:"موجودی قدیمی",quantity:5,totalCost:4000,receivedAt:0});
 const sale=planLotSale({productId:1,productName:"FDY",warehouseId:2,quantity:10,warehouseStock:{stock:10,value:9000},lots:[legacy,imported]});
 const rows=summarizeLotProfit({lots:[...new Map([legacy,imported,...sale.newLots,...sale.updates].map(lot=>[lot.id,lot])).values()],invoices:[{kind:"SALE",status:"POSTED",lines:[{qty:10,totalQty:10,lineTotal:20000,lotAllocations:sale.allocations}]}]});
 assert.equal(rows.length,1);assert.equal(rows[0].sourceNumber,"CN-3");assert.equal(rows[0].revenue,10000);assert.equal(rows[0].grossProfit,5000);
});

test("preserves zero timestamp for legacy opening stock and consumes it before newer lots",()=>{
 const legacy=planLotReceipt({productId:1,productName:"FDY",warehouseId:2,sourceType:"LEGACY",sourceId:"legacy-old",sourceNumber:"موجودی قدیمی",quantity:5,totalCost:4000,receivedAt:0});
 const imported=receipt("CN-NEW",5,5000,100);
 assert.equal(legacy.receivedAt,0);
 const sale=planLotSale({productId:1,productName:"FDY",warehouseId:2,quantity:2,warehouseStock:{stock:10,value:9000},lots:[imported,legacy]});
 assert.equal(sale.allocations[0].sourceType,"LEGACY");
 assert.equal(sale.allocations[0].quantity,2);
});
test("rejects malformed lot balances and non-finite unit costs",()=>{
 const lot=receipt("CN-BAD",5,5000,100);
 assert.throws(()=>planLotSale({productId:1,warehouseId:2,quantity:1,warehouseStock:{stock:5,value:5000},lots:[{...lot,remainingQty:NaN}]}));
 assert.throws(()=>planLotReceipt({productId:1,productName:"FDY",warehouseId:2,sourceType:"IMPORT_SHIPMENT",sourceId:"tiny",quantity:Number.MIN_VALUE,totalCost:1}));
});
test("allocates rounded invoice revenue across four lots without negative amounts or lost total",()=>{
 const lots=[receipt("CN-A",1,1,100),receipt("CN-B",1,1,200),receipt("CN-C",1,1,300),receipt("CN-D",1,1,400)];
 const sale=planLotSale({productId:1,productName:"FDY",warehouseId:2,quantity:4,warehouseStock:{stock:4,value:4},lots,date:500});
 const rows=summarizeLotProfit({lots:[...sale.updates],invoices:[{kind:"SALE",status:"POSTED",lines:[{qty:4,totalQty:4,lineTotal:2,lotAllocations:sale.allocations}]}]});
 assert.equal(rows.reduce((sum,row)=>sum+row.revenue,0),2);
 assert.ok(rows.every(row=>row.revenue>=0));
});
test("ignores historical sales without lot allocations instead of failing shipment reports",()=>{
 const lot=receipt("CN-HIST",5,5000,100);
 const rows=summarizeLotProfit({lots:[lot],invoices:[{kind:"SALE",status:"POSTED",lines:[{qty:2,totalQty:2,lineTotal:2000}]}]});
 assert.equal(rows.length,1);
 assert.equal(rows[0].revenue,0);
 assert.equal(rows[0].soldQty,0);
});

test("PWA integrates FIFO lots with database, shipment receipt, invoice sales, transfers and reversals",()=>{
 const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"..");
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8"),html=fs.readFileSync(path.join(root,"index.html"),"utf8"),sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.match(app,/DB_VERSION=11/);assert.match(app,/"inventoryLots"/);
 assert.match(html,/inventory-lots\.js\?v=inventory-lots-1/);
 assert.ok(html.indexOf("inventory-lots.js")<html.indexOf("app.js?v="));
 assert.match(sw,/\.\/inventory-lots\.js/);assert.match(sw,/inventory-lots\\.js/);
 assert.match(app,/sourceType:"IMPORT_SHIPMENT"/);assert.match(app,/sourceType:"PURCHASE_INVOICE"/);
 assert.match(app,/planLotSale\(/);assert.match(app,/lotAllocations/);assert.match(app,/restoreLotSale\(/);
 assert.match(app,/summarizeImportShipmentProfit\(/);assert.match(app,/سود ناخالص کانتینرها/);
});

test("aggregates repeated allocations to the same lot before restoring a multi-line invoice",()=>{
 const lot={...receipt("CN-MULTI",100,125000,100),remainingQty:85,remainingValue:106250,status:"OPEN"};
 const restored=restoreLotSale({lots:[lot],allocations:[
  {lotId:lot.id,quantity:10,cogs:12500},
  {lotId:lot.id,quantity:5,cogs:6250}
 ],date:500});
 assert.equal(restored.length,1);
 assert.equal(restored[0].remainingQty,100);
 assert.equal(restored[0].remainingValue,125000);
});

test("summarizes realized shipment profit, margin, sell-through and remaining inventory value",()=>{
 const {summarizeImportShipmentProfit,buildImportShipmentProfitCsv}=require("../inventory-lots.js");
 const lot=receipt("CN-PROFIT",100,100000,100);
 const sale=planLotSale({productId:1,productName:"FDY",warehouseId:2,quantity:40,warehouseStock:{stock:100,value:100000},lots:[lot],date:200});
 const lots=[...sale.newLots,...sale.updates];
 const invoices=[{kind:"SALE",status:"POSTED",lines:[{qty:40,totalQty:40,lineTotal:60000,lotAllocations:sale.allocations}]}];
 const report=summarizeImportShipmentProfit({lots,invoices});
 assert.equal(report.rows[0].soldCost,40000);assert.equal(report.rows[0].grossProfit,20000);
 assert.ok(Math.abs(report.rows[0].grossMarginPercent-100/3)<1e-10);assert.equal(report.rows[0].sellThroughPercent,40);
 assert.equal(report.totals.remainingValue,60000);assert.ok(buildImportShipmentProfitCsv({lots,invoices}).startsWith("\uFEFF"));
});
