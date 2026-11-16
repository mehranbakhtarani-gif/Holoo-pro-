const test=require("node:test");
const assert=require("node:assert/strict");
const {calculateImportCapitalPlan,compareImportCapitalScenarios}=require("../import-capital-planner.js");
const base={containerCount:1,goodsUsdPerContainer:50000,grossKgPerContainer:20000,fxRialPerUsd:600000,advancePercent:30,otherCostsRialPerContainer:300000000,otherCostsUpfrontPercent:60,availableCapitalRial:10000000000,shippingDays:75,creditDaysAfterReceipt:90,salePriceRialPerKg:2500000,sellThroughDays:120,monthlyOperatingCostRial:100000000};
test("calculates one-container landed cost, upfront cash and deferred supplier balance",()=>{
 const p=calculateImportCapitalPlan(base);
 assert.equal(p.totalGoodsUsd,50000);assert.equal(p.goodsRialPerContainer,30000000000);
 assert.equal(p.totalLandedCost,30300000000);assert.equal(p.landedCostPerKg,1515000);
 assert.equal(p.supplierAdvancePerContainer,9000000000);assert.equal(p.otherCostsUpfrontPerContainer,180000000);
 assert.equal(p.cashNeededNow,9180000000);assert.equal(p.futureSupplierPayable,21000000000);
 assert.equal(p.futureOtherCosts,120000000);assert.equal(p.futurePayableDueDaysAfterOrder,165);
 assert.equal(p.cashGap,0);assert.equal(p.grossProfit,19700000000);
});
test("compares 1, 2 and 4 containers linearly without mixing currencies",()=>{
 const rows=compareImportCapitalScenarios(base);
 assert.deepEqual(rows.map(x=>x.containerCount),[1,2,4]);
 assert.deepEqual(rows.map(x=>x.totalGoodsUsd),[50000,100000,200000]);
 assert.deepEqual(rows.map(x=>x.totalWeightKg),[20000,40000,80000]);
 assert.deepEqual(rows.map(x=>x.cashNeededNow),[9180000000,18360000000,36720000000]);
 assert.deepEqual(rows.map(x=>x.futureSupplierPayable),[21000000000,42000000000,84000000000]);
 assert.equal(rows[0].landedCostPerKg,rows[2].landedCostPerKg);
});
test("flags working-capital gap and leaves profitability unknown without sale price",()=>{
 const p=calculateImportCapitalPlan({...base,availableCapitalRial:1000000000,salePriceRialPerKg:0});
 assert.equal(p.cashGap,8180000000);assert.equal(p.grossProfit,null);assert.equal(p.marginPercent,null);
});
test("validates unsafe, negative, missing and out-of-range inputs",()=>{
 for(const patch of [{containerCount:0},{goodsUsdPerContainer:-1},{grossKgPerContainer:0},{fxRialPerUsd:1.5},{advancePercent:101},{otherCostsRialPerContainer:-1},{availableCapitalRial:-1},{shippingDays:731},{creditDaysAfterReceipt:-1},{salePriceRialPerKg:1.2},{monthlyOperatingCostRial:-1}]){
  assert.throws(()=>calculateImportCapitalPlan({...base,...patch}),/معتبر/);
 }
 assert.throws(()=>compareImportCapitalScenarios(base,[1,0,4]),/معتبر/);
});
test("handles zero ancillary costs and zero supplier advance",()=>{
 const p=calculateImportCapitalPlan({...base,advancePercent:0,otherCostsRialPerContainer:0,otherCostsUpfrontPercent:0});
 assert.equal(p.cashNeededNow,0);assert.equal(p.futureSupplierPayable,30000000000);
 assert.equal(p.landedCostPerKg,1500000);assert.equal(p.cashGap,0);
});

test("capital planner converts USD cents exactly and rejects unsupported fractional precision",()=>{
 const p=calculateImportCapitalPlan({...base,goodsUsdPerContainer:50000.25});
 assert.equal(p.totalGoodsUsd,50000.25);
 assert.equal(p.goodsRialPerContainer,30000150000);
 assert.throws(()=>calculateImportCapitalPlan({...base,goodsUsdPerContainer:50000.123}),/معتبر/);
});
test("capital planner rejects overflow in landed cost, cash requirement and projected revenue",()=>{
 assert.throws(()=>calculateImportCapitalPlan({...base,otherCostsRialPerContainer:Number.MAX_SAFE_INTEGER,containerCount:2}),/محدوده/);
 assert.throws(()=>calculateImportCapitalPlan({...base,fxRialPerUsd:Number.MAX_SAFE_INTEGER}),/محدوده/);
 assert.throws(()=>calculateImportCapitalPlan({...base,salePriceRialPerKg:Number.MAX_SAFE_INTEGER,grossKgPerContainer:100}),/محدوده/);
});


test("capital planner exposes gross margin and monthly operating cash estimate without mixing them with gross profit",()=>{
 const p=calculateImportCapitalPlan({...base,salePriceRialPerKg:2000000,sellThroughDays:60,monthlyOperatingCostRial:100000000});
 assert.equal(p.grossProfit,9700000000);
 assert.equal(p.marginPercent,9700000000/40000000000*100);
 assert.equal(p.monthlyRevenue,20000000000);
 assert.equal(p.monthlyNetAfterOperating,19900000000);
});

test("capital planner rejects unsafe converted available capital instead of silently overflowing",()=>{
 assert.throws(()=>calculateImportCapitalPlan({...base,availableCapitalRial:Number.MAX_SAFE_INTEGER+1}),/معتبر/);
});

test("import planner UI compares one two and four containers and labels gross and monthly estimates separately",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/compareImportCapitalScenarios\(common,\[1,2,4\]\)/);
 assert.match(app,/حاشیه سود ناخالص/);
 assert.match(app,/جریان عملیاتی ماهانه پس از هزینه/);
 assert.match(app,/availableCapitalUsd/);
 assert.match(app,/این صفحه فقط سناریو می‌سازد/);
});
