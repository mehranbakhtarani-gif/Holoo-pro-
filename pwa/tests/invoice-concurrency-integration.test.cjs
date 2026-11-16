const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("invoice posting revalidates product, warehouse, FIFO lot and party snapshots atomically",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("async function saveForm");
 const invoiceStart=app.indexOf('if(page==="invoices"){',start);
 const invoiceEnd=app.indexOf('\nif(page==="allocations")',invoiceStart);
 assert.ok(start>=0&&invoiceStart>start&&invoiceEnd>invoiceStart,"invoice save branch must exist");
 const body=app.slice(invoiceStart,invoiceEnd);
 assert.match(body,/expectedPartyBalance=p\.balance/);
 assert.match(body,/expectedCommissionPartyBalance=commissionParty\?\.balance/);
 assert.match(body,/expectedProductStates=\[\]/);
 assert.match(body,/expectedWarehouseStates=\[\]/);
 assert.match(body,/expectedProductStates\.push\(\{id:Number\(product\.id\),expected:\{stock:product\.stock,value:product\.value\}\}\)/);
 assert.match(body,/expectedWarehouseStates\.push\(\{productId:Number\(product\.id\),warehouseId,expected:existingWarehouseRow\?/);
 assert.match(body,/const lotGuards=lotUpdates\.map/);
 assert.match(body,/expected:previous\?\{remainingQty:previous\.remainingQty,remainingValue:previous\.remainingValue,status:previous\.status\}:null/);
 assert.match(body,/store:"parties",key:Number\(p\.id\),expected:\{balance:expectedPartyBalance\}/);
 assert.match(body,/store:"parties",key:Number\(commissionParty\.id\),expected:\{balance:expectedCommissionPartyBalance\}/);
 assert.match(body,/journal,invoiceGuards\)/);
});

test("atomic voucher posting validates all guards in the same readwrite transaction before writing",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("function postVoucherAtomic");
 const end=app.indexOf("\nfunction all(s)",start);
 assert.ok(start>=0&&end>start,"atomic voucher helper must exist");
 const body=app.slice(start,end);
 assert.match(body,/guards\.map\(x=>x\.store\)/);
 assert.match(body,/request=guard\.match\?store\.getAll\(\):store\.get\(guard\.key\)/);
 assert.match(body,/if\(!valid\).*staleState=true/);
 assert.match(body,/completed===guards\.length\)writeEntriesAndVoucher\(\)/);
});
