const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),app=fs.readFileSync(path.join(root,"app.js"),"utf8"),html=fs.readFileSync(path.join(root,"index.html"),"utf8"),sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
test("inventory reports and barcode printing are connected",()=>{assert.match(app,/inventoryReports:\["گزارش‌های انبار"/);assert.match(app,/if\(currentPage==="inventoryReports"\)/);assert.match(app,/printBarcodeLabels/);assert.match(app,/buildInventoryKardex/);assert.match(app,/buildStagnantInventoryReport/);});
test("inventory-control module loads before app and is included in offline cache",()=>{assert.ok(html.indexOf("inventory-control.js")<html.indexOf("app.js?v="));assert.match(sw,/\.\/inventory-control\.js/);assert.match(sw,/inventory-control\\.js/);});

test("inventory reports expose a persistent count sheet and controlled variance posting",()=>{
 assert.match(app,/DB_VERSION=12/);
 assert.match(app,/"stocktakes"/);
 assert.match(app,/id="createStocktake"/);
 assert.match(app,/id="stocktakeSessionSelect"/);
 assert.match(app,/id="saveStocktakeCounts"/);
 assert.match(app,/data-stocktake-apply=/);
 assert.match(app,/stocktakeId:Number\(options\.stocktakeId\)/);
 assert.match(app,/expectedWarehouseState/);assert.match(fs.readFileSync(path.join(root,"inventory-control.js"),"utf8"),/globalThis\.HolooInventoryControl=\{[^}]*buildStocktakeSheet/);
});
test("stocktake store migration is additive and offline assets receive a new cache version",()=>{
 assert.match(app,/for\(const s of stores\)if\(!d\.objectStoreNames\.contains\(s\)\)d\.createObjectStore\(s/);
 assert.match(html,/inventory-control\.js\?v=inventory-control-6/);
 assert.match(sw,/holloo-pwa-v170-fx-reversal-order/);
 assert.match(sw,/\.\/inventory-control\.js/);
});

test("inventory kardex date range includes the full selected end date and localizes movement types",()=>{
 assert.match(app,/to:parseDate\(\$\("#kardexTo"\)\.value,true\)/);
 assert.match(app,/new Date\(y,m-1,d,23,59,59,999\)\.getTime\(\)/);
 assert.match(app,/PURCHASE_REVERSAL:"برگشت خرید"/);
 assert.match(app,/SALE_REVERSAL:"برگشت فروش"/);
 assert.match(app,/movementLabel\(x\.type\)/);
});

test("inventory reorder report is wired to the shared product thresholds and has a separate CSV export",()=>{
 assert.match(app,/id="runReorderReport"/);
 assert.match(app,/id="exportReorderCsv"/);
 assert.match(app,/buildReorderReport\(\{products\}\)/);
 assert.match(app,/holloo-reorder-suggestions\.csv/);
 assert.match(fs.readFileSync(path.join(root,"inventory-control.js"),"utf8"),/function buildReorderReport\(input\)/);
});

test("stock adjustment reversal persists FIFO provenance and is exposed only for eligible records",()=>{assert.match(app,/fifoAllocations=sale\.allocations\.map/);assert.match(app,/createdLotIds\.push/);assert.match(app,/voucherReference:"STOCK_ADJUSTMENT:"/);assert.match(app,/async function reverseStockAdjustmentPwa/);assert.match(app,/restoreLotSale\(\{lots,allocations:adjustment\.fifoAllocations/);assert.match(app,/STOCK_ADJUSTMENT_REVERSAL:/);assert.match(app,/data-stock-adjustment-reverse=/);assert.match(app,/اطلاعات FIFO قدیمی ناقص/);});
test("stock adjustment reversal ships with refreshed PWA cache",()=>{assert.match(html,/app\.js\?v=reverse-order-2/);assert.match(sw,/holloo-pwa-v170-fx-reversal-order/);});

test("inventory reports expose read-only reconciliation for warehouse stock, FIFO and account 1301",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/id="runInventoryReconciliation"/);
 assert.match(app,/buildInventoryReconciliation\(\{products,warehouseStock:stockRows,inventoryLots,accounts,vouchers,voucherLines\}\)/);
 assert.match(app,/all\("inventoryLots"\)/);
 assert.match(app,/تطبیق حساب ۱۳۰۱/);
});
