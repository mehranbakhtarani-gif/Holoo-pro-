const test=require("node:test");
const assert=require("node:assert/strict");
const {getInvoiceSettlement,validateTreasuryAllocation}=require("../settlement.js");

test("draft invoices cannot be settled or allocated",()=>{
 const draft={number:"D-1",status:"DRAFT",total:500};
 assert.deepEqual(getInvoiceSettlement(draft,[]),{paid:0,outstanding:0,status:"DRAFT"});
 assert.throws(()=>validateTreasuryAllocation({transaction:{id:1,partyId:2,kind:"RECEIPT",amount:500},invoice:{...draft,kind:"SALE",partyId:2},amount:100,allocations:[]}),/فاکتور ثبت‌شده/);
});

test("only posted or legacy invoices and active treasury transactions may be allocated",()=>{
 assert.equal(validateTreasuryAllocation({transaction:{id:1,partyId:2,kind:"RECEIPT",amount:500},invoice:{number:"I-1",status:"POSTED",kind:"SALE",partyId:2,total:500},amount:200,allocations:[]}),true);
 assert.throws(()=>validateTreasuryAllocation({transaction:{id:1,partyId:2,kind:"RECEIPT",amount:500,status:"REVERSED"},invoice:{number:"I-1",status:"POSTED",kind:"SALE",partyId:2,total:500},amount:200,allocations:[]}),/تراکنش و فاکتور ثبت‌شده/);
});

test("settlement totals reject unsafe, negative or overallocated balances",()=>{
 assert.throws(()=>getInvoiceSettlement({number:"I-2",status:"POSTED",total:100},[{invoiceNumber:"I-2",amount:150}]),/مانده تسویه/);
 assert.throws(()=>getInvoiceSettlement({number:"I-2",status:"POSTED",total:Number.MAX_SAFE_INTEGER+1},[]),/مانده تسویه/);
});
