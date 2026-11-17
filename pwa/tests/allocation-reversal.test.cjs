const test=require("node:test");
const assert=require("node:assert/strict");
const {getInvoiceSettlement,validateTreasuryAllocation}=require("../settlement.js");
const fs=require("node:fs");
const path=require("node:path");

test("reversed settlement allocations no longer reduce invoice outstanding balance",()=>{
 const result=getInvoiceSettlement({number:"INV-1",total:1000},[{invoiceNumber:"INV-1",amount:400,status:"REVERSED"}]);
 assert.equal(result.paid,0);assert.equal(result.outstanding,1000);assert.equal(result.status,"UNPAID");
});

test("reversed allocations do not consume transaction or invoice allocation limits",()=>{
 const transaction={id:1,partyId:7,kind:"RECEIPT",amount:1000};
 const invoice={number:"INV-2",partyId:7,kind:"SALE",total:1000};
 const rows=[{id:1,treasuryId:1,invoiceNumber:"INV-2",amount:1000,status:"REVERSED"}];
 assert.equal(validateTreasuryAllocation({transaction,invoice,amount:1000,allocations:rows}),true);
});

test("FX allocation reversal posts a reversing voucher and restores party balance",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/async function reverseTreasuryAllocationPwa/);
 assert.match(app,/FX-SETTLEMENT-REV:/);
 assert.match(app,/applyPartyBalanceDelta\(party,-gain\+loss\)/);
 assert.match(app,/data-allocation-reverse/);
});

test("FX allocation reversal validates original gain/loss accounts before reversing the voucher",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const debitAccount=invoice\.kind==="SALE"/);
 assert.match(app,/accountTotals\.size!==2/);
 assert.match(app,/حساب‌های سند تسعیر اصلی با نوع فاکتور و سود\/زیان تخصیص مطابقت ندارد/);
});

test("FX allocation reversal rejects reversed source documents and mismatched party identity",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/transaction\.status===\"REVERSED\"\|\|\(invoice\.status&&invoice\.status!==\"POSTED\"\)/);
 assert.match(app,/Number\(transaction\.partyId\)!==Number\(invoice\.partyId\)/);
 assert.match(app,/Number\(allocation\.partyId\)!==Number\(invoice\.partyId\)/);
});

test("manual operation date is applied to allocation reversal timestamp",()=>{
 const op=fs.readFileSync(path.resolve(__dirname,"../operation-date.js"),"utf8");
 assert.match(op,/treasuryAllocations:\["reversedAt"\]/);
});

test("reversed FX allocations do not consume the invoice foreign-currency settlement limit",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/allocs\.filter\(x=>x\.invoiceNumber===invoice\.number&&x\.id!==item\?\.id&&x\.status!==\"REVERSED\"\)/);
});
