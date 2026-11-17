const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("foreign payable payments guard payable, shipment, supplier and duplicate references",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf('if(page==="foreignPayablePayments")');
 const end=app.indexOf('\nif(page==="approvals")',start);
 assert.ok(start>=0&&end>start);
 const body=app.slice(start,end);
 for(const expected of [
  "const payableSnapshot={...payable}",
  "const sourceShipmentSnapshot={...sourceShipment}",
  "const partySnapshot={...party}",
  'store:"foreignPayables",key:Number(payable.id),expected:payableSnapshot',
  'store:"importShipments",key:Number(sourceShipment.id),expected:sourceShipmentSnapshot',
  'store:"parties",key:Number(party.id),expected:partySnapshot',
  'store:"foreignPayablePayments",match:{reference},expected:null',
  'store:"treasury",match:{reference},expected:null'
 ])assert.ok(body.includes(expected),"Missing foreign payable payment guard: "+expected);
});

test("treasury receipts and payments guard supplier/customer balance and duplicate reference",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf('if(page==="treasury")');
 const end=app.indexOf('\nasync function reverseForeignPayablePaymentPwa',start);
 assert.ok(start>=0&&end>start);
 const body=app.slice(start,end);
 assert.ok(body.includes("const partySnapshot={...p}"));
 assert.ok(body.includes('store:"parties",key:Number(p.id),expected:partySnapshot'));
 assert.ok(body.includes('store:"treasury",match:{reference},expected:null'));
});

test("foreign payable payment reversal guards the payment, payable, party and treasury rows",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("async function reverseForeignPayablePaymentPwa");
 const end=app.indexOf("\nasync function exportBackup",start);
 assert.ok(start>=0&&end>start);
 const body=app.slice(start,end);
 for(const expected of [
  "const paymentSnapshot={...payment},payableSnapshot={...payable},partySnapshot={...party},sourceShipmentSnapshot={...sourceShipment},originalTreasurySnapshot={...originalTreasury}",
  'store:"foreignPayables",key:payable.id,expected:payableSnapshot',
  'store:"foreignPayablePayments",key:payment.id,expected:paymentSnapshot',
  'store:"parties",key:party.id,expected:partySnapshot',
  'store:"treasury",key:originalTreasury.id,expected:originalTreasurySnapshot',
  'store:"treasury",match:{reference},expected:null'
 ])assert.ok(body.includes(expected),"Missing foreign payable reversal guard: "+expected);
});

 
test("treasury allocation creation and reversal use invoice and settlement version guards",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.ok(app.includes('incrementAllocationVersion(tr,"خزانه");incrementAllocationVersion(invoice,"فاکتور");'));
 assert.ok(app.includes('incrementAllocationVersion(transaction,"خزانه");'));
 assert.match(app,/function incrementAllocationVersion\(record,label="سند"\)/);
 assert.ok(app.includes('store:"treasury",key:Number(tr.id),expected:transactionSnapshot'));
 assert.ok(app.includes('store:"invoices",key:Number(invoice.id),expected:invoiceSnapshot'));
 assert.ok(app.includes('allocationVersion:invoice.allocationVersion'));
 assert.ok(app.includes("treasurySnapshot={...original}"));
 assert.ok(app.includes("originalSnapshot={...original}"));
 assert.ok(app.includes('await putManyGuarded([["treasury",tr],["invoices",invoice],["treasuryAllocations",allocation]]'));
});

test("every active treasury allocation is reversed through the guarded allocation action",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf('if(currentPage==="allocations")');
 const end=app.indexOf('if(currentPage==="foreignPayables")',start);
 const body=app.slice(start,end);
 assert.ok(body.includes('data-allocation-reverse'));
 assert.ok(!body.includes('data-del="treasuryAllocations:'));
});

test("FX allocations reconcile cash Rial and invoice booked Rial independently using cumulative conversion",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf('if(page==="allocations"){');
 const end=app.indexOf('\nif(page==="warehouseTransfers"){',start);
 assert.ok(start>=0&&end>start);
 const body=app.slice(start,end);
 assert.ok(body.includes("calculateTreasuryForeignAllocation({transaction:tr,amount,allocations:allocs})"));
 assert.ok(body.includes("calculateCumulativeRealizedForeignExchange({"));
 assert.ok(body.includes('invoiceAmount:invoiceCurrency==="IRR"?amount:Number(allocation.bookedRial)'));
 assert.ok(body.includes("previousInvoiceBookedRial"));
 assert.ok(body.includes("previousTransactionSettlementRial"));
 assert.ok(app.includes("validateTreasuryAllocationReversalOrder({allocation,allocations})"));
});
