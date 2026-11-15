const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { calculateImportShipmentCost } = require("../import-cost.js");
const { getInvoiceSettlement, validateTreasuryAllocation } = require("../settlement.js");
const { calculateWarehouseStockMovement } = require("../warehouse-stock.js");
const { calculateWarehouseTransfer } = require("../warehouse-transfer.js");
const root = path.resolve(__dirname, "..");

test("calculates converted goods cost, landed cost and cost per kg", () => {
  const result = calculateImportShipmentCost({
    currency: "USD", fx: 50000, goods: 1000, weight: 25000,
    freight: 1000000, customs: 400000, other: 100000
  });
  assert.deepEqual(result, {
    goodsRial: 50000000, totalCost: 51500000, unitCost: 2060
  });
});

test("rejects unsupported currencies and invalid base values", () => {
  assert.throws(() => calculateImportShipmentCost({currency:"IRR",fx:1,goods:1,weight:1}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:0,goods:1,weight:1}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:1,goods:0,weight:1}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:1,goods:1,weight:0}));
});

test("rejects negative, fractional or overflowing ancillary costs", () => {
  assert.throws(() => calculateImportShipmentCost({currency:"CNY",fx:1,goods:1,weight:1,freight:-1}));
  assert.throws(() => calculateImportShipmentCost({currency:"EUR",fx:1,goods:1,weight:1,customs:1.5}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:Number.MAX_SAFE_INTEGER,goods:2,weight:1}));
});

test("PWA loads the helper before app code and precaches it", () => {
  const html = fs.readFileSync(path.join(root,"index.html"),"utf8");
  const sw = fs.readFileSync(path.join(root,"sw.js"),"utf8");
  assert.ok(html.indexOf("import-cost.js") >= 0);
  assert.ok(html.indexOf("import-cost.js") < html.indexOf("app.js"));
  assert.match(sw, /\.\/import-cost\.js/);
  assert.match(fs.readFileSync(path.join(root,"app.js"),"utf8"), /calculateImportShipmentCost/);
});

test("derives paid, outstanding and settlement status from allocations", () => {
  const invoice = {number:"S-1",total:1000};
  assert.deepEqual(getInvoiceSettlement(invoice,[{invoiceNumber:"S-1",amount:350}]),{paid:350,outstanding:650,status:"PARTIAL"});
  assert.deepEqual(getInvoiceSettlement(invoice,[{invoiceNumber:"S-1",amount:1000}]),{paid:1000,outstanding:0,status:"PAID"});
  assert.equal(getInvoiceSettlement({...invoice,status:"REVERSED"},[]).status,"REVERSED");
});

test("accepts valid same-party receipt allocation to a sales invoice", () => {
  assert.equal(validateTreasuryAllocation({
    transaction:{id:7,kind:"RECEIPT",partyId:2,amount:800},
    invoice:{number:"S-2",kind:"SALE",partyId:2,total:500},
    amount:500,allocations:[]
  }),true);
});

test("rejects mismatched parties, wrong direction and over-allocation", () => {
  const transaction={id:7,kind:"RECEIPT",partyId:2,amount:800};
  const invoice={number:"S-3",kind:"SALE",partyId:2,total:500};
  assert.throws(()=>validateTreasuryAllocation({transaction,invoice:{...invoice,partyId:9},amount:100,allocations:[]}));
  assert.throws(()=>validateTreasuryAllocation({transaction:{...transaction,kind:"PAYMENT"},invoice,amount:100,allocations:[]}));
  assert.throws(()=>validateTreasuryAllocation({transaction,invoice,amount:801,allocations:[]}));
  assert.throws(()=>validateTreasuryAllocation({transaction,invoice,amount:501,allocations:[]}));
  assert.throws(()=>validateTreasuryAllocation({transaction,invoice:{...invoice,status:"REVERSED"},amount:100,allocations:[]}));
});

test("editing an allocation excludes its previous value from limits", () => {
  assert.equal(validateTreasuryAllocation({
    transaction:{id:7,kind:"RECEIPT",partyId:2,amount:500},
    invoice:{number:"S-4",kind:"SALE",partyId:2,total:500},
    amount:500,currentAllocationId:10,
    allocations:[{id:10,treasuryId:7,invoiceNumber:"S-4",amount:500}]
  }),true);
});

test("moves legacy stock into the first selected warehouse", () => {
 const result=calculateWarehouseStockMovement({
  product:{id:4,name:"FDY",stock:100,value:50000},
  warehouseId:1,warehouseRows:[],quantity:10,direction:"SALE"
 });
 assert.equal(result.cogs,5000);
 assert.equal(result.stock,90);
 assert.equal(result.value,45000);
 assert.equal(result.record.warehouseId,1);
});

test("keeps stock balances independent between warehouses", () => {
 const rows=[{id:1,productId:4,warehouseId:1,stock:50,value:25000}];
 const result=calculateWarehouseStockMovement({
  product:{id:4,name:"FDY",stock:50,value:25000},
  warehouseId:2,warehouseRows:rows,quantity:5,direction:"PURCHASE",lineTotal:4000
 });
 assert.equal(result.stock,5);
 assert.equal(result.value,4000);
 assert.equal(result.record.warehouseId,2);
});

test("rejects warehouse overselling and duplicate warehouse stock records", () => {
 const product={id:4,name:"FDY",stock:20,value:10000};
 assert.throws(()=>calculateWarehouseStockMovement({product,warehouseId:1,warehouseRows:[{productId:4,warehouseId:1,stock:4,value:2000}],quantity:5,direction:"SALE"}));
 assert.throws(()=>calculateWarehouseStockMovement({product,warehouseId:1,warehouseRows:[{productId:4,warehouseId:1,stock:4,value:2000},{productId:4,warehouseId:1,stock:4,value:2000}],quantity:1,direction:"SALE"}));
});

test("uses the warehouse-specific average cost for partial issues", () => {
 const result=calculateWarehouseStockMovement({
  product:{id:4,name:"FDY",stock:80,value:80000},
  warehouseId:3,warehouseRows:[{id:9,productId:4,warehouseId:3,stock:10,value:30000}],
  quantity:2,direction:"SALE"
 });
 assert.equal(result.cogs,6000);
 assert.equal(result.stock,8);
 assert.equal(result.value,24000);
});

test("transfers stock and book value between warehouses without changing total value", () => {
 const result=calculateWarehouseTransfer({
  product:{id:8,name:"FDY"},
  source:{id:1},destination:{id:2},quantity:4,
  sourceRows:[{id:11,productId:8,warehouseId:1,stock:10,value:30000}],
  destinationRows:[{id:12,productId:8,warehouseId:2,stock:2,value:5000}]
 });
 assert.equal(result.quantity,4);
 assert.equal(result.value,12000);
 assert.equal(result.sourceRecord.stock,6);
 assert.equal(result.sourceRecord.value,18000);
 assert.equal(result.destinationRecord.stock,6);
 assert.equal(result.destinationRecord.value,17000);
});

test("rejects same-warehouse transfers and transfers beyond source stock", () => {
 const base={product:{id:8,name:"FDY"},source:{id:1},destination:{id:2},quantity:5,sourceRows:[{id:11,productId:8,warehouseId:1,stock:4,value:12000}],destinationRows:[]};
 assert.throws(()=>calculateWarehouseTransfer({...base,destination:{id:1}}));
 assert.throws(()=>calculateWarehouseTransfer(base));
});
