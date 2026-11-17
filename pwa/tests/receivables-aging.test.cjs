const test=require("node:test");
const assert=require("node:assert/strict");
const {buildReceivablePayableAging}=require("../receivables-aging.js");
const day=86400000,asOf=Date.UTC(2026,3,1);
const invoices=[
 {number:"S-1",kind:"SALE",status:"POSTED",partyId:1,partyName:"مشتری الف",total:100000,date:asOf-40*day,dueDate:asOf-40*day},
 {number:"S-2",kind:"SALE",status:"POSTED",partyId:1,partyName:"مشتری الف",total:50000,date:asOf-10*day,dueDate:asOf+5*day},
 {number:"S-3",kind:"SALE",status:"POSTED",partyId:2,partyName:"مشتری ب",total:50000,date:asOf-100*day,dueDate:asOf-100*day},
 {number:"S-4",kind:"SALE",status:"POSTED",partyId:2,partyName:"مشتری ب",total:30000,date:asOf-20*day,dueDate:asOf-20*day},
 {number:"P-1",kind:"PURCHASE",status:"POSTED",partyId:3,partyName:"تأمین‌کننده ج",total:70000,date:asOf-70*day,dueDate:asOf-70*day},
 {number:"S-REV",kind:"SALE",status:"REVERSED",partyId:4,partyName:"برگشتی",total:90000,date:asOf-50*day,dueDate:asOf-50*day}
];
const allocations=[
 {invoiceNumber:"S-1",amount:25000},
 {invoiceNumber:"S-3",amount:20000},
 {invoiceNumber:"S-4",amount:30000},
 {invoiceNumber:"P-1",amount:10000}
];
test("groups outstanding sales and purchases by due-date aging buckets",()=>{
 const report=buildReceivablePayableAging({invoices,allocations,asOfDate:asOf});
 assert.equal(report.receivables.total,155000);
 assert.equal(report.payables.total,60000);
 assert.equal(report.receivables.count,3);
 assert.equal(report.payables.count,1);
 assert.equal(report.receivables.byBucket.find(x=>x.key==="1_30").amount,0);
 assert.equal(report.receivables.byBucket.find(x=>x.key==="31_60").amount,75000);
 assert.equal(report.receivables.byBucket.find(x=>x.key==="current").amount,50000);
 assert.equal(report.receivables.byBucket.find(x=>x.key==="over_90").amount,30000);
 assert.equal(report.payables.byBucket.find(x=>x.key==="61_90").amount,60000);
});
test("uses invoice date when no due date exists and marks the source",()=>{
 const report=buildReceivablePayableAging({invoices:[{number:"OLD",kind:"SALE",total:1000,date:asOf-95*day}],allocations:[],asOfDate:asOf});
 assert.equal(report.receivables.rows[0].bucket,"over_90");
 assert.equal(report.receivables.rows[0].dueDateSource,"INVOICE_DATE");
});
test("excludes fully settled and reversed invoices and groups by party",()=>{
 const report=buildReceivablePayableAging({invoices,allocations,asOfDate:asOf});
 assert.deepEqual(report.receivables.byParty.map(x=>[x.partyName,x.amount]),[["مشتری الف",125000],["مشتری ب",30000]]);
});
test("rejects invalid dates and unsafe amounts",()=>{
 assert.throws(()=>buildReceivablePayableAging({invoices:[{number:"BAD",kind:"SALE",total:1,date:0}],asOfDate:asOf}));
 assert.throws(()=>buildReceivablePayableAging({invoices:[{number:"BAD",kind:"SALE",total:Number.MAX_SAFE_INTEGER+1,date:asOf}],asOfDate:asOf}));
});

 
test("aging reports include only posted invoices and ignore reversed allocations",()=>{
 const report=buildReceivablePayableAging({asOfDate:Date.UTC(2026,0,31),invoices:[
  {number:"POSTED",kind:"SALE",status:"POSTED",total:100,dueDate:Date.UTC(2026,0,1),partyName:"A"},
  {number:"LEGACY",kind:"PURCHASE",total:80,dueDate:Date.UTC(2026,0,1),partyName:"B"},
  {number:"DRAFT",kind:"SALE",status:"DRAFT",total:900,dueDate:Date.UTC(2026,0,1),partyName:"C"},
  {number:"REVERSED",kind:"SALE",status:"REVERSED",total:700,dueDate:Date.UTC(2026,0,1),partyName:"D"}
 ],allocations:[
  {invoiceNumber:"POSTED",amount:40,status:"ACTIVE"},
  {invoiceNumber:"POSTED",amount:20,status:"REVERSED"}
 ]});
 assert.equal(report.receivables.total,60);
 assert.equal(report.receivables.rows.length,1);
 assert.equal(report.payables.total,80);
 assert.equal(report.payables.rows.length,1);
});

test("aging reports reject overallocated invoices instead of hiding negative balances",()=>{
 assert.throws(()=>buildReceivablePayableAging({asOfDate:Date.UTC(2026,0,31),invoices:[{number:"OVER",kind:"SALE",status:"POSTED",total:100,dueDate:Date.UTC(2026,0,1)}],allocations:[{invoiceNumber:"OVER",amount:150,status:"ACTIVE"}]}),/بیشتر است/);
});

test("foreign invoice aging uses booked Rial rather than settlement cash Rial",()=>{
 const report=buildReceivablePayableAging({asOfDate:Date.UTC(2026,3,1),invoices:[
  {number:"FX-AGING",kind:"SALE",status:"POSTED",currency:"USD",total:600000000,date:Date.UTC(2026,2,1),dueDate:Date.UTC(2026,2,1),partyName:"مشتری ارزی"}
 ],allocations:[
  {invoiceNumber:"FX-AGING",amount:650000000,bookedRial:600000000,foreignAmountMinor:100000,status:"ACTIVE"}
 ]});
 assert.equal(report.receivables.total,0);
 assert.equal(report.receivables.rows.length,0);
});
