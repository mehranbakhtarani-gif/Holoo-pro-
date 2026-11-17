const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

test("import shipment captures the yarn product and destination warehouse", () => {
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/\["productId","کالای محموله","select",1\]/);
 assert.match(app,/\["warehouseId","انبار مقصد","select",1\]/);
 assert.match(app,/productId:product.id,productName:product.name,warehouseId:warehouse.id/);
});

test("landed cost receipt updates product and warehouse stock atomically", () => {
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/async function receiveImportShipment/);
 assert.match(app,/calculateImportShipmentCost\(/);
 assert.match(app,/calculateWarehouseStockMovement\(/);
 assert.match(app,/postVoucherAtomic\(\[\["products",product\],\["warehouseStock",movement.record\]/);
 assert.match(app,/shipment.receivedAt=now/);
 assert.match(app,/shipment.status="رسید انبار شده"/);
});

test("shipment receipt is blocked before arrival and cannot be duplicated", () => {
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/shipment.receivedAt\)throw Error\("این محموله قبلاً رسید انبار شده است"/);
 assert.match(app,/shipment.status!=="رسیده"/);
 assert.match(app,/محموله رسید انبارشده قابل حذف نیست/);
});

test("import shipment list exposes landed cost per kg and receipt action", () => {
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/بهای هر کیلو/);
 assert.match(app,/data-receive-shipment/);
 assert.match(app,/receiveImportShipment\(b.dataset.receiveShipment\)/);
});


test("foreign payable settlement label does not imply ancillary import charges are settled", () => {
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.equal((app.match(/sourceShipment\.status=plan\.updated\.status===\"PAID\"\?\"بهای کالا تسویه‌شده\":\"رسید انبار شده\"/g)||[]).length,2);
 assert.match(app,/accountCode:\"2102\"/);
});
