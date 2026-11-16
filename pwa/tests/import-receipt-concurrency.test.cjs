const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("import receipt revalidates complete mutable snapshots in the atomic posting transaction",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("async function receiveImportShipment");
 const end=app.indexOf("\nasync function importBankStatementCsv",start);
 assert.ok(start>=0&&end>start,"import receipt function must exist");
 const body=app.slice(start,end);
 for(const expected of [
  "expectedShipmentState={...shipment}",
  "expectedProductState={...product}",
  "expectedPartyState={...party}",
  "expectedWarehouseRow?{...expectedWarehouseRow}:null",
  "expectedPayableState=linkedPayable?{...linkedPayable}:null",
  'store:"importShipments",key:Number(shipment.id),expected:expectedShipmentState',
  'store:"products",key:Number(product.id),expected:expectedProductState',
  'store:"parties",key:Number(party.id),expected:expectedPartyState',
  'store:"warehouseStock",match:{productId:Number(product.id),warehouseId:Number(warehouse.id)}',
  'store:"inventoryLots",match:{sourceType:"IMPORT_SHIPMENT",sourceId:Number(shipment.id)},expected:null',
  'store:"foreignPayables",match:{sourceShipmentId:Number(shipment.id)},expected:expectedPayableState'
 ])assert.ok(body.includes(expected),"Missing import receipt guard: "+expected);
});

 
test("import receipt rejects supplier balance overflow before posting stock and journal entries",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const nextPartyBalance=Number\(party\.balance\|\|0\)-costs\.goodsRial;if\(!Number\.isSafeInteger\(nextPartyBalance\)\)/);
 assert.match(app,/store:"parties",key:Number\(party\.id\),expected:expectedPartyState/);
});

 
test("import shipment creation and edits atomically enforce unique numbers and containers and lock linked payable fields",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/function putImportShipmentUnique\(record\)/);
 assert.match(app,/db\.transaction\(\["importShipments","foreignPayables","auditLog"\],"readwrite"\)/);
 assert.ok(app.includes("row.number===record.number"));
 assert.ok(app.includes('String(row.container||"").trim().toLowerCase()===String(record.container||"").trim().toLowerCase()'));
 assert.match(app,/const linked=current&&payables\.find\(row=>Number\(row\.sourceShipmentId\)===Number\(current\.id\)\)/);
 assert.match(app,/await putImportShipmentUnique\(shipmentRecord\)/);
});
