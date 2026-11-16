const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("invoice reversal revalidates all affected ledger and inventory snapshots atomically",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("async function reversePwaInvoice");
 const end=app.indexOf("\nasync function printInvoiceDocument",start);
 assert.ok(start>=0&&end>start,"invoice reversal function must exist");
 const body=app.slice(start,end);
 for(const expected of [
  "const invoiceSnapshot={...invoice}",
  "new Map(products.map(row=>[Number(row.id),{...row}]))",
  "new Map(parties.map(row=>[Number(row.id),{...row}]))",
  "new Map(warehouseStockRows.map(row=>[Number(row.productId)+\":\"+Number(row.warehouseId),{...row}]))",
  "new Map(inventoryLots.map(row=>[String(row.id),{...row}]))",
  'const guards=[{store:"invoices",key:Number(invoice.id),expected:invoiceSnapshot}]',
  'guards.push({store:"parties",key:id,expected:snapshot})',
  'guards.push({store:"products",key:id,expected:snapshot})',
  'guards.push({store:"warehouseStock",match:{productId,warehouseId},expected:snapshot})',
  'guards.push({store:"inventoryLots",key:snapshot.id,expected:snapshot})',
  "reverseVoucherLines,guards)"
 ])assert.ok(body.includes(expected),"Missing reversal guard: "+expected);
});
