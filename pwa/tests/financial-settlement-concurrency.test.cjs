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
