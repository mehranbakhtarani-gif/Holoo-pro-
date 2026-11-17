const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("import orders support search, edit and delete actions",()=>{
 assert.match(app,/جست‌وجوی کانتینر، تأمین‌کننده یا ارز/);
 assert.match(app,/imports\.filter\(x=>\[x\.supplierName,x\.container,x\.currency\]/);
 assert.match(app,/actButtons\("imports",x\.id\)/);
 assert.match(app,/id:item\?\.id,supplierId:p\.id/);
});

test("import order requires a valid supplier, unique container and safe direct costs",()=>{
 assert.match(app,/p\.kind==="CUSTOMER"/);
 assert.match(app,/شماره کانتینر قبلاً ثبت شده است/);
 assert.match(app,/هزینه‌های جانبی باید عدد صحیح و غیرمنفی باشند/);
});

 
test("shipment landed cost includes every itemized direct cost",()=>{
 assert.match(app,/insurance:num\("insurance"\),port:num\("port"\),inland:num\("inland"\),broker:num\("broker"\),storage:num\("storage"\),bank:num\("bank"\),other:num\("other"\)/);
});

test("shipment search covers container, supplier and product and deletion protects linked payables",()=>{
 assert.match(app,/جست‌وجوی شماره محموله، کانتینر، کالا یا تأمین‌کننده/);
 assert.match(app,/payables\.some\(x=>Number\(x\.sourceShipmentId\)===key\)/);
});

test("shipment finance fields are locked after a foreign payable is created",()=>{
 assert.match(app,/برای این محموله تعهد ارزی ثبت شده است؛ اطلاعات مالی، کالا و تأمین‌کننده قفل شده‌اند/);
});

 
test("shipment settlement status follows payable payment and reversal",()=>{
 assert.match(app,/sourceShipment\.status=plan\.updated\.status==="PAID"\?"تسویه‌شده":"رسید انبار شده"/);
 assert.match(app,/statusChangedAt=now/);
});
test("legacy import order report separates foreign goods, Rial goods value, ancillary costs and landed cost",()=>{
 assert.match(app,/بهای ریالی کالا/);
 assert.match(app,/هزینه‌های جانبی/);
 assert.match(app,/جمع بهای تمام‌شده/);
 assert.match(app,/ancillaryCost=freight\+customs\+other,totalCost=goodsRial\+ancillaryCost/);
 assert.match(app,/goodsRial,ancillaryCost,totalCost,extra:totalCost/);
});

test("import shipment CSV exports container, supplier, itemized direct costs and receipt trace",()=>{
 assert.match(app,/id="exportImportShipmentsCsv"/);
 assert.match(app,/holloo-import-shipments\.csv/);
 assert.match(app,/هزینه جانبی کل/);
 assert.match(app,/شماره سند رسید/);
 assert.match(app,/receivedVoucherNumber/);
});


test("import shipment itemized cost headers align one-to-one with displayed values",()=>{
 const config=app.indexOf('const cfg={warehouses:');
 const start=app.indexOf('importShipments:[',config),end=app.indexOf('],approvals:',start);
 assert.ok(config>=0&&start>config&&end>start);
 assert.equal((app.slice(start,end).match(/"/g)||[]).length/2,23);
});

 
test("import order container uniqueness is checked in the same transaction as create or edit",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/function putImportOrderUnique\(record\)/);
 assert.match(app,/db\.transaction\(\["imports","auditLog"\],"readwrite"\)/);
 assert.ok(app.includes('String(row.container||"").trim().toLowerCase()===String(record.container||"").trim().toLowerCase()'));
 assert.match(app,/await putImportOrderUnique\(\{id:item\?\.id,supplierId:p\.id/);
});

 
test("legacy import-order writes apply the shared automatic or manual operation date",()=>{
 assert.match(app,/function putImportOrderUnique\(record\)\{\s*const stamp=globalThis\.HolooOperationDate\?\.stampOperationRecord/);
 assert.match(app,/stamp\(\{store:"imports",record,mode:operationDateMode,manualValue:operationManualDate\}\)/);
 assert.match(app,/const value=stamp\(\{store:"imports",record,mode:operationDateMode,manualValue:operationManualDate\}\)/);
});

test("legacy import order and payable booking share exact two-decimal FX conversion",()=>{
 assert.match(app,/goodsRial=convertForeignGoodsToRial\(goods,fx\)\.goodsRial/);
 assert.match(app,/amountMinor=convertForeignGoodsToRial\(shipment\.goods,shipment\.fx\)\.goodsMinor/);
});
