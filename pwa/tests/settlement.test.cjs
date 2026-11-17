const test=require("node:test");
const assert=require("node:assert/strict");
const {getInvoiceSettlement,validateTreasuryAllocation,calculateTreasuryForeignAllocation,getActiveInvoiceForeignAllocatedMinor}=require("../settlement.js");

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

test("foreign treasury allocations distribute minor units cumulatively and consume the exact final residual",()=>{
 const transaction={id:12,currency:"USD",amount:10000,foreignAmountMinor:1000};
 const first=calculateTreasuryForeignAllocation({transaction,amount:3333,allocations:[]});
 assert.equal(first,333);
 const rows=[{treasuryId:12,amount:3333,foreignAmountMinor:first,status:"ACTIVE"}];
 const second=calculateTreasuryForeignAllocation({transaction,amount:3333,allocations:rows});
 assert.equal(second,333);
 rows.push({treasuryId:12,amount:3333,foreignAmountMinor:second,status:"ACTIVE"});
 const third=calculateTreasuryForeignAllocation({transaction,amount:3334,allocations:rows});
 assert.equal(third,334);
 assert.equal(first+second+third,transaction.foreignAmountMinor);
 assert.throws(()=>calculateTreasuryForeignAllocation({transaction,amount:1,allocations:[...rows,{treasuryId:12,amount:6666,foreignAmountMinor:666,status:"ACTIVE"}]}),/سوابق تخصیص ارزی/);
});

test("reversed FX allocations release transaction and invoice foreign minor units",()=>{
 const transaction={id:13,currency:"CNY",amount:10000,foreignAmountMinor:1000};
 const rows=[
  {id:1,treasuryId:13,invoiceNumber:"I-13",amount:5000,foreignAmountMinor:500,status:"REVERSED"},
  {id:2,treasuryId:13,invoiceNumber:"I-13",amount:2500,foreignAmountMinor:250,status:"ACTIVE"}
 ];
 assert.equal(calculateTreasuryForeignAllocation({transaction,amount:7500,allocations:rows}),750);
 assert.equal(getActiveInvoiceForeignAllocatedMinor("I-13",rows),250);
});
