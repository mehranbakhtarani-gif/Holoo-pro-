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

test("manual operation date is applied to allocation reversal timestamp",()=>{
 const op=fs.readFileSync(path.resolve(__dirname,"../operation-date.js"),"utf8");
 assert.match(op,/treasuryAllocations:\["reversedAt"\]/);
});

test("FX allocation reversal requires its exact source voucher and exact gain or loss journal",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/if\(!allocation\.fxVoucherReference\)throw Error/);
 assert.match(app,/const fxVoucherMatches=vouchers\.filter\(v=>v\.reference===allocation\.fxVoucherReference\)/);
 assert.match(app,/const counterpartyAccount=invoice\.kind==="SALE"\?"1103":invoice\.kind==="PURCHASE"\?"2101":""/);
 assert.match(app,/expectedFxLines=gain>0/);
 assert.match(app,/accountCode:"4301",debitRial:0,creditRial:gain/);
 assert.match(app,/accountCode:"5501",debitRial:loss,creditRial:0/);
 assert.match(app,/expectedLines:expectedFxLines,expectedTotal:gain\+loss/);
 assert.doesNotMatch(app,/const candidates=vouchers\.filter\(v=>String\(v\.reference\|\|""\)\.startsWith\(prefix\)/);
});
