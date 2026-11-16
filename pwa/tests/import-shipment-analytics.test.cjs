const test=require("node:test");
const assert=require("node:assert/strict");
const {summarizeImportShipments}=require("../import-shipment-analytics.js");
const shipments=[
 {number:"CN-01",container:"A",supplierId:1,supplierName:"Supplier A",productId:10,productName:"FDY سفید 60D",currency:"USD",goods:1000,goodsRial:50000000,weight:25000,freight:1000000,customs:400000,other:100000,totalCost:51500000,status:"رسید انبار شده",updatedAt:2},
 {number:"CN-02",container:"B",supplierId:1,supplierName:"Supplier A",productId:10,productName:"FDY سفید 60D",currency:"USD",goods:800,goodsRial:40000000,weight:20000,freight:800000,customs:300000,other:100000,totalCost:41200000,status:"در حال حمل",updatedAt:3},
 {number:"CN-03",container:"C",supplierId:2,supplierName:"Supplier B",productId:11,productName:"FDY طلایی 60D",currency:"CNY",goods:5000,goodsRial:35000000,weight:15000,freight:500000,customs:200000,other:0,totalCost:35700000,status:"سفارش",updatedAt:1}
];
test("calculates aggregate landed cost, ancillary cost and weighted cost per kg",()=>{
 const report=summarizeImportShipments({shipments});
 assert.equal(report.count,3);
 assert.equal(report.totalWeight,60000);
 assert.equal(report.totalGoodsRial,125000000);
 assert.equal(report.totalAncillary,3400000);
 assert.equal(report.totalLanded,128400000);
 assert.equal(report.weightedUnitCost,2140);
 assert.equal(report.receivedWeight,25000);
 assert.equal(report.inTransitWeight,35000);
});
test("groups landed cost by product and supplier without mixing currencies",()=>{
 const report=summarizeImportShipments({shipments});
 assert.equal(report.productRows[0].productName,"FDY سفید 60D");
 assert.equal(report.productRows[0].weight,45000);
 assert.equal(report.productRows[0].landedCost,92700000);
 assert.equal(report.supplierRows[0].supplierName,"Supplier A");
 assert.equal(report.foreignGoods.USD,1800);
 assert.equal(report.foreignGoods.CNY,5000);
});
test("returns safe empty summaries and rejects invalid shipment costs",()=>{
 const empty=summarizeImportShipments({shipments:[]});
 assert.equal(empty.count,0);
 assert.equal(empty.weightedUnitCost,0);
 assert.throws(()=>summarizeImportShipments({shipments:[{weight:1,goodsRial:100,totalCost:99}]}));
 assert.throws(()=>summarizeImportShipments({shipments:[{weight:0,goodsRial:0,totalCost:0}]}));
});
