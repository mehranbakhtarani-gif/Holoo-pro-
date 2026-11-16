const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("import receipt revalidates all mutable snapshots in the atomic posting transaction",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("async function receiveImportShipment");
 const end=app.indexOf("\nasync function importBankStatementCsv",start);
 assert.ok(start>=0&&end>start,"import receipt function must exist");
 const body=app.slice(start,end);
 assert.match(body,/expectedShipmentState=\{status:shipment\.status,receivedAt:shipment\.receivedAt\}/);
 assert.match(body,/expectedProductState=\{stock:product\.stock,value:product\.value\}/);
 assert.match(body,/expectedPartyBalance=party\.balance/);
 assert.match(body,/expectedWarehouseRow=stockRows\.find/);
 assert.match(body,/expectedPayableState=linkedPayable\?/);
 assert.match(body,/store:"importShipments",key:Number\(shipment\.id\),expected:expectedShipmentState/);
 assert.match(body,/store:"products",key:Number\(product\.id\),expected:expectedProductState/);
 assert.match(body,/store:"parties",key:Number\(party\.id\),expected:\{balance:expectedPartyBalance\}/);
 assert.match(body,/store:"warehouseStock",match:\{productId:Number\(product\.id\),warehouseId:Number\(warehouse\.id\)\}/);
 assert.match(body,/store:"inventoryLots",match:\{sourceType:"IMPORT_SHIPMENT",sourceId:Number\(shipment\.id\)\},expected:null/);
 assert.match(body,/store:"foreignPayables",match:\{sourceShipmentId:Number\(shipment\.id\)\},expected:expectedPayableState/);
 assert.match(body,/receivedVoucherNumber:|receivedVoucherNumber=/);
});
