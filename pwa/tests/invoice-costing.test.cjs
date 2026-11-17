const test=require("node:test");
const assert=require("node:assert/strict");
const {allocatePurchaseInventoryCosts}=require("../invoice-costing.js");
test("allocates invoice-wide purchase discount and tax proportionally across inventory lots",()=>{
 const lines=[{lineTotal:6000},{lineTotal:4000}];
 const costs=allocatePurchaseInventoryCosts(lines,9500);
 assert.deepEqual(costs,[5700,3800]);
 assert.equal(costs.reduce((sum,value)=>sum+value,0),9500);
});
test("uses largest remainders so allocated integer rial costs exactly equal invoice total",()=>{
 assert.deepEqual(allocatePurchaseInventoryCosts([{lineTotal:1},{lineTotal:1},{lineTotal:1}],2),[1,1,0]);
 assert.deepEqual(allocatePurchaseInventoryCosts([{lineTotal:1},{lineTotal:2},{lineTotal:3}],7),[1,2,4]);
});
test("rejects missing lines, zero bases, negative values and unsafe amounts",()=>{
 assert.throws(()=>allocatePurchaseInventoryCosts([],100));
 assert.throws(()=>allocatePurchaseInventoryCosts([{lineTotal:0}],100));
 assert.throws(()=>allocatePurchaseInventoryCosts([{lineTotal:-1}],100));
 assert.throws(()=>allocatePurchaseInventoryCosts([{lineTotal:1}],0));
 assert.throws(()=>allocatePurchaseInventoryCosts([{lineTotal:Number.MAX_SAFE_INTEGER},{lineTotal:1}],2));
});
test("PWA applies allocated purchase cost to product, warehouse, lot and reversal basis",()=>{
 const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"..");
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8"),html=fs.readFileSync(path.join(root,"index.html"),"utf8"),sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.match(app,/HolooInvoiceCosting\.allocatePurchaseInventoryCosts\(lines,total\)/);
 assert.match(app,/row\.product\.value=Number\(row\.product\.value\|\|0\)\+delta/);
 assert.match(app,/row\.warehouseRecord\.value=Number\(row\.warehouseRecord\.value\|\|0\)\+delta/);
 assert.match(app,/row\.lot\.originalCost=cost/);
 assert.match(app,/line\.inventoryCostRial\?\?line\.lineTotal/);
 assert.ok(html.indexOf("invoice-costing.js")<html.indexOf("app.js?v="));
 assert.match(sw,/\.\/invoice-costing\.js/);
 assert.match(sw,/invoice-costing\\.js/);
});

test("allocates multi-line net costs with invoice discount and tax using exact largest remainders",()=>{
 const lines=[{lineTotal:3333},{lineTotal:3333},{lineTotal:3334}];
 const snapshot=JSON.stringify(lines);
 const costs=allocatePurchaseInventoryCosts(lines,10001);
 assert.deepEqual(costs,[3333,3333,3335]);
 assert.equal(costs.reduce((sum,value)=>sum+value,0),10001);
 assert.equal(JSON.stringify(lines),snapshot);
});
test("supports the largest safe rial amount without floating-point allocation drift",()=>{
 assert.deepEqual(allocatePurchaseInventoryCosts([{lineTotal:1}],Number.MAX_SAFE_INTEGER),[Number.MAX_SAFE_INTEGER]);
});
test("rejects non-finite and fractional rial inputs",()=>{
 for(const total of [NaN,Infinity,-Infinity,1.5])assert.throws(()=>allocatePurchaseInventoryCosts([{lineTotal:10}],total));
 for(const lineTotal of [NaN,Infinity,-Infinity,1.5])assert.throws(()=>allocatePurchaseInventoryCosts([{lineTotal}],10));
});
