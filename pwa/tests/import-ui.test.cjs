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

