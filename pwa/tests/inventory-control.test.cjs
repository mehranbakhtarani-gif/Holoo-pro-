const test=require("node:test");
const assert=require("node:assert/strict");
const {code39Svg,buildInventoryKardex,buildStagnantInventoryReport,buildReorderReport,buildStocktakeSheet,buildStocktakeComparison,buildInventoryCsv}=require("../inventory-control.js");
const day=86400000;
test("Code 39 label renderer accepts normalized alphanumeric codes and rejects unsupported codes",()=>{
 const svg=code39Svg("ab-123");assert.match(svg,/<svg/);assert.match(svg,/<rect/);assert.match(svg,/AB-123/);
 assert.throws(()=>code39Svg("کد-۱۲۳"),/حروف لاتین/);assert.throws(()=>code39Svg(""),/خالی/);assert.throws(()=>code39Svg("A".repeat(49)),/۴۸/);
});
test("kardex reconstructs opening and closing quantity/value and includes balanced reversal events",()=>{
 const input={productId:1,products:[{id:1,stock:12,value:1800}],invoices:[
  {id:1,kind:"PURCHASE",number:"P1",date:100,lines:[{productId:1,qty:10,lineTotal:1000}]},
  {id:2,kind:"SALE",number:"S1",date:200,lines:[{productId:1,qty:3,cogs:300}]},
  {id:3,kind:"PURCHASE",status:"DRAFT",date:250,lines:[{productId:1,qty:99,lineTotal:9900}]},
  {id:4,kind:"SALE",status:"REVERSED",date:260,reversedAt:300,lines:[{productId:1,qty:2,cogs:200}]}
 ]};
 const result=buildInventoryKardex(input);
 assert.deepEqual(result.opening,{quantity:5,value:1100});
 assert.equal(result.rows.length,4);assert.equal(result.rows.filter(row=>row.type==="SALE_REVERSAL").length,1);assert.equal(result.closing.quantity,12);assert.equal(result.closing.value,1800);
});
test("kardex date window starts from reconstructed opening and does not double-count when from is omitted",()=>{
 const input={productId:1,products:[{id:1,stock:12,value:1800}],invoices:[
  {id:1,kind:"PURCHASE",date:100,lines:[{productId:1,qty:10,lineTotal:1000}]},
  {id:2,kind:"SALE",date:200,lines:[{productId:1,qty:3,cogs:300}]}
 ]};
 const result=buildInventoryKardex({...input,to:150});
 assert.deepEqual(result.opening,{quantity:5,value:1100});
 assert.equal(result.rows.length,1);assert.equal(result.closing.quantity,15);assert.equal(result.closing.value,2100);
});
test("kardex filters by warehouse and includes transfer receipts and issues",()=>{
 const input={productId:1,warehouseId:2,products:[{id:1,stock:7,value:700}],warehouseStock:[{productId:1,warehouseId:2,stock:7,value:700}],transfers:[{id:1,productId:1,sourceWarehouseId:1,destinationWarehouseId:2,quantity:5,value:500,date:100,number:"T1"}]};
 const result=buildInventoryKardex({...input,from:100,to:100});
 assert.equal(result.opening.quantity,2);assert.equal(result.rows[0].quantityIn,5);assert.equal(result.closing.quantity,7);
});
test("company-wide stagnant report counts warehouse transfers as movement",()=>{
 const rows=buildStagnantInventoryReport({asOf:100*day,staleDays:90,products:[{id:1,name:"moved",stock:5,value:500}],transfers:[{productId:1,sourceWarehouseId:1,destinationWarehouseId:2,quantity:1,value:100,date:5*day}]});
 assert.equal(rows[0].status,"STAGNANT");assert.equal(rows[0].daysSinceLastMovement,95);
});
test("stocktake comparison calculates differences without mutating ledger inputs",()=>{
 const stockRows=[{productId:1,warehouseId:2,stock:10,value:2500}],products=[{id:1,name:"FDY",sku:"A1"}],counts=[{productId:1,warehouseId:2,countedQty:8.5}],before=JSON.stringify(stockRows);
 const rows=buildStocktakeComparison({stockRows,products,counts});
 assert.equal(rows[0].deltaQty,-1.5);assert.equal(rows[0].valueDelta,-375);assert.equal(rows[0].status,"DIFFERENCE");assert.equal(JSON.stringify(stockRows),before);
 assert.throws(()=>buildStocktakeComparison({stockRows,products,counts:[...counts,...counts]}),/تکراری/);
});
test("stagnant report distinguishes unknown legacy movement history from genuinely old movement",()=>{
 const rows=buildStagnantInventoryReport({asOf:100*day,staleDays:90,products:[{id:1,name:"old",stock:2,value:200},{id:2,name:"legacy",stock:3,value:300}],invoices:[{id:1,kind:"SALE",date:1,lines:[{productId:1,qty:1,cogs:100}]}]});
 assert.equal(rows.find(x=>x.productId===1).status,"STAGNANT");assert.equal(rows.find(x=>x.productId===1).daysSinceLastMovement,99);assert.equal(rows.find(x=>x.productId===2).status,"UNKNOWN");
});
test("CSV export preserves Persian text and escapes quotes",()=>{
 const csv=buildInventoryCsv([["نخ \"سفید\"",10]],[["کالا","مقدار"]]);assert.ok(csv.startsWith("\uFEFF"));assert.ok(csv.includes('"نخ ""سفید"""'));
});

test("stocktake sheet snapshots each warehouse balance and assigns legacy stock only to the primary warehouse",()=>{
 const products=[{id:1,name:"FDY",sku:"A1",stock:10,value:2500,avg:250},{id:2,name:"DTY",stock:4,value:800,avg:200}];
 const stockRows=[{id:9,productId:1,warehouseId:2,stock:6,value:1500}];
 const primary=buildStocktakeSheet({products,stockRows,warehouseId:1,legacyWarehouseId:1});
 assert.equal(primary[0].expectedQty,0);assert.equal(primary[0].expectedValue,0);assert.equal(primary[1].expectedQty,4);
 const secondary=buildStocktakeSheet({products,stockRows,warehouseId:2,legacyWarehouseId:1});
 assert.equal(secondary[0].expectedQty,6);assert.equal(secondary[1].expectedQty,0);
 assert.deepEqual(secondary[0].expectedWarehouseState,stockRows[0]);
 assert.throws(()=>buildStocktakeSheet({products,stockRows:[...stockRows,{...stockRows[0]}],warehouseId:2,legacyWarehouseId:1}),/تکراری/);
});
test("stocktake comparison uses saved count-session snapshots rather than changed live stock rows",()=>{
 const products=[{id:1,name:"FDY",avg:250}],counts=[{productId:1,warehouseId:2,expectedQty:10,expectedValue:2500,countedQty:8.5}];
 const result=buildStocktakeComparison({products,counts,stockRows:[{productId:1,warehouseId:2,stock:100,value:90000}]});
 assert.equal(result[0].expectedQty,10);assert.equal(result[0].expectedValue,2500);assert.equal(result[0].deltaQty,-1.5);assert.equal(result[0].valueDelta,-375);
});

test("kardex preserves the original invoice and reversal date as separate inventory movements",()=>{
 const result=buildInventoryKardex({productId:1,products:[{id:1,stock:10,value:1000}],invoices:[
  {id:1,kind:"PURCHASE",number:"P-REV",date:100,status:"REVERSED",reversedAt:300,lines:[{productId:1,qty:5,inventoryCostRial:500}]}
 ]});
 assert.equal(result.rows.length,2);
 assert.equal(result.rows[0].type,"PURCHASE");
 assert.equal(result.rows[0].date,100);
 assert.equal(result.rows[1].type,"PURCHASE_REVERSAL");
 assert.equal(result.rows[1].date,300);
 assert.equal(result.closing.quantity,10);
 assert.equal(result.closing.value,1000);
});

test("reorder report suggests replenishment to max stock, or minimum when no maximum is set",()=>{
 const rows=buildReorderReport({products:[
  {id:1,sku:"A",name:"below min",stock:4,minStock:5,maxStock:12,avg:200},
  {id:2,sku:"B",name:"no max",stock:2,minStock:5,maxStock:0,avg:100},
  {id:3,sku:"C",name:"healthy",stock:6,minStock:5,maxStock:10,avg:300},
  {id:4,sku:"D",name:"unset",stock:0,minStock:0,maxStock:10,avg:10}
 ]});
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.productId),[1,2]);
 assert.equal(rows[0].recommendedQty,8);assert.equal(rows[0].estimatedValue,1600);
 assert.equal(rows[1].recommendedQty,3);assert.equal(rows[1].estimatedValue,300);
});
test("reorder report rejects inconsistent stock thresholds and unsafe estimated values",()=>{
 assert.throws(()=>buildReorderReport({products:[{id:1,name:"bad",stock:2,minStock:8,maxStock:5,avg:10}]}),/حداکثر/);
 assert.throws(()=>buildReorderReport({products:[{id:1,name:"bad",stock:0,minStock:2,maxStock:0,avg:Number.MAX_SAFE_INTEGER}]}),/محدوده/);
});

test("kardex records a reversed warehouse transfer at the reversal date for both warehouses",()=>{
 const transfer={id:9,number:"WT-KDX",productId:1,sourceWarehouseId:2,destinationWarehouseId:3,quantity:4,value:12000,date:100,status:"REVERSED",reversedAt:300};
 const products=[{id:1,stock:10,value:30000}];
 const all=buildInventoryKardex({productId:1,products,transfers:[transfer]});
 assert.deepEqual(all.rows.map(x=>x.type),["TRANSFER_IN","TRANSFER_OUT","TRANSFER_REVERSAL_IN","TRANSFER_REVERSAL_OUT"]);
 assert.deepEqual(all.rows.map(x=>x.date),[100,100,300,300]);
 assert.equal(all.closing.quantity,10);assert.equal(all.closing.value,30000);
 const source=buildInventoryKardex({productId:1,warehouseId:2,products,warehouseStock:[{productId:1,warehouseId:2,stock:6,value:18000}],transfers:[transfer]});
 assert.equal(source.closing.quantity,6);assert.equal(source.closing.value,18000);
 assert.deepEqual(source.rows.map(x=>x.type),["TRANSFER_OUT","TRANSFER_REVERSAL_IN"]);
 const destination=buildInventoryKardex({productId:1,warehouseId:3,products,warehouseStock:[{productId:1,warehouseId:3,stock:4,value:12000}],transfers:[transfer]});
 assert.equal(destination.closing.quantity,4);assert.equal(destination.closing.value,12000);
 assert.deepEqual(destination.rows.map(x=>x.type),["TRANSFER_IN","TRANSFER_REVERSAL_OUT"]);
});
