const test=require("node:test");
const assert=require("node:assert/strict");
const {code39Svg,buildInventoryKardex,buildStagnantInventoryReport,buildStocktakeComparison,buildInventoryCsv}=require("../inventory-control.js");
const day=86400000;
test("Code 39 label renderer accepts normalized alphanumeric codes and rejects unsupported codes",()=>{
 const svg=code39Svg("ab-123");assert.match(svg,/<svg/);assert.match(svg,/<rect/);assert.match(svg,/AB-123/);
 assert.throws(()=>code39Svg("کد-۱۲۳"),/حروف لاتین/);assert.throws(()=>code39Svg(""),/خالی/);assert.throws(()=>code39Svg("A".repeat(49)),/۴۸/);
});
test("kardex shows original and separate reversal movement while ignoring drafts",()=>{
 const input={productId:1,products:[{id:1,stock:12,value:1800}],invoices:[
  {id:1,kind:"PURCHASE",number:"P1",date:100,lines:[{productId:1,qty:10,lineTotal:1000}]},
  {id:2,kind:"SALE",number:"S1",date:200,lines:[{productId:1,qty:3,cogs:300}]},
  {id:3,kind:"PURCHASE",status:"DRAFT",date:250,lines:[{productId:1,qty:99,lineTotal:9900}]},
  {id:4,kind:"SALE",status:"REVERSED",date:260,lines:[{productId:1,qty:99,cogs:9900}]}
 ],adjustments:[{id:5,kind:"INVOICE_REVERSAL",invoiceNumber:"S2",productId:1,warehouseId:0,deltaKg:99,valueRial:9900,date:261,reference:"INVOICE-REVERSAL:S2:0"}]};
 const result=buildInventoryKardex(input);
 assert.deepEqual(result.opening,{quantity:5,value:1100});
 assert.equal(result.rows.length,4);assert.ok(result.rows.some(x=>x.type==="INVOICE_REVERSAL"&&x.description.includes("برگشت فاکتور")));
 assert.equal(result.closing.quantity,12);assert.equal(result.closing.value,1800);
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
