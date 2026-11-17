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
  "const invoiceSnapshot={status:invoice.status,reversedAt:invoice.reversedAt,allocationVersion:invoice.allocationVersion}",
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


test("sale invoice reversal verifies FIFO allocation quantity and COGS against each invoice line",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("async function reversePwaInvoice");
 const end=app.indexOf("\nasync function printInvoiceDocument",start);
 const body=app.slice(start,end);
 for(const expected of [
  "allocatedQty=line.lotAllocations.reduce((sum,row)=>sum+Number(row.quantity),0)",
  "Math.abs(allocatedQty-totalQty)>1e-6",
  "allocatedCogs!==cost",
  "جمع مقدار یا بهای تخصیص‌های FIFO با ردیف فاکتور فروش یکسان نیست"
 ]) assert.ok(body.includes(expected),"Missing FIFO reversal validation: "+expected);
});


test("invoice reversal verifies FIFO lot ownership before restoring or removing a lot",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("async function reversePwaInvoice");
 const end=app.indexOf("\nasync function printInvoiceDocument",start);
 const body=app.slice(start,end);
 for(const expected of [
  'Number(allocatedLot.productId)!==Number(product.id)',
  'Number(allocatedLot.warehouseId)!==warehouseId',
  'sourceLot.sourceType!=="PURCHASE_INVOICE"',
  'String(sourceLot.sourceId)!==String(invoice.number)',
  'Math.abs(Number(sourceLot.remainingQty)-Number(sourceLot.originalQty))>1e-6',
  'Number(sourceLot.remainingValue)!==Number(sourceLot.originalCost)'
 ]) assert.ok(body.includes(expected),"Missing FIFO lot ownership/integrity guard: "+expected);
});
