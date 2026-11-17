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
 assert.match(app,/expectedWarehouseState/);
});
test("stocktake store migration is additive and offline assets receive a new cache version",()=>{
 assert.match(app,/for\(const s of stores\)if\(!d\.objectStoreNames\.contains\(s\)\)d\.createObjectStore\(s/);
 assert.match(html,/inventory-control\.js\?v=inventory-control-2/);
 assert.match(sw,/holloo-pwa-v161-stocktake/);
 assert.match(sw,/\.\/inventory-control\.js/);
});
