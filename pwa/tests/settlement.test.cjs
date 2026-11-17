const test=require("node:test");
const assert=require("node:assert/strict");
const {getInvoiceSettlement,validateTreasuryAllocation,calculateTreasuryForeignAllocation,getActiveInvoiceForeignAllocatedMinor,validateTreasuryAllocationReversalOrder}=require("../settlement.js");

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

test("foreign invoice settlement uses booked Rial, not the cash Rial amount",()=>{
 const result=getInvoiceSettlement({number:"FX-1",currency:"USD",status:"POSTED",total:600000000},[
  {invoiceNumber:"FX-1",amount:650000000,bookedRial:600000000,foreignAmountMinor:100000,status:"ACTIVE"}
 ]);
 assert.deepEqual(result,{paid:600000000,outstanding:0,status:"PAID"});
});

test("foreign invoice allocation validates cash and booked balances independently",()=>{
 const transaction={id:21,partyId:7,kind:"RECEIPT",currency:"USD",amount:650000000,foreignAmountMinor:100000};
 const invoice={number:"FX-2",partyId:7,kind:"SALE",currency:"USD",total:600000000,foreignTotalMinor:100000,status:"POSTED"};
 assert.equal(validateTreasuryAllocation({transaction,invoice,amount:650000000,invoiceAmount:600000000,allocations:[]}),true);
 assert.throws(()=>validateTreasuryAllocation({transaction,invoice,amount:650000000,invoiceAmount:600000001,allocations:[]}),/مانده فاکتور/);
});

test("reversed foreign allocations release the invoice booked and foreign balance",()=>{
 const invoice={number:"FX-3",currency:"EUR",status:"POSTED",total:900000,foreignTotalMinor:150};
 const rows=[{invoiceNumber:"FX-3",amount:900000,bookedRial:900000,foreignAmountMinor:150,status:"REVERSED"}];
 assert.deepEqual(getInvoiceSettlement(invoice,rows),{paid:0,outstanding:900000,status:"UNPAID"});
 assert.equal(getActiveInvoiceForeignAllocatedMinor("FX-3",rows),0);
});

test("cumulative FX allocation reversals must follow reverse order across invoice and treasury chains",()=>{
 const first={id:10,treasuryId:3,invoiceNumber:"INV-A",currency:"USD",foreignAmountMinor:300};
 const second={id:11,treasuryId:4,invoiceNumber:"INV-A",currency:"USD",foreignAmountMinor:200};
 const third={id:12,treasuryId:3,invoiceNumber:"INV-B",currency:"USD",foreignAmountMinor:100};
 const rows=[first,second,third];
 assert.throws(()=>validateTreasuryAllocationReversalOrder({allocation:first,allocations:rows}),/جدیدترین تخصیص/);
 assert.throws(()=>validateTreasuryAllocationReversalOrder({allocation:second,allocations:rows}),/جدیدترین تخصیص/);
 assert.equal(validateTreasuryAllocationReversalOrder({allocation:third,allocations:rows}),true);
 assert.equal(validateTreasuryAllocationReversalOrder({allocation:second,allocations:[first,second]}),true);
});
