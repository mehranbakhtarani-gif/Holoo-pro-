const test=require("node:test");
const assert=require("node:assert/strict");
const {planPartyOpeningBalance}=require("../party-opening-balance.js");

test("customer debit opening balance posts to receivables against opening equity",()=>{
 const plan=planPartyOpeningBalance({partyKind:"CUSTOMER",balance:125000});
 assert.equal(plan.debitRial,125000);assert.equal(plan.creditRial,0);
 assert.deepEqual(plan.journal.map(x=>[x.accountCode,x.debitRial,x.creditRial]),[["1103",125000,0],["3102",0,125000]]);
});

test("supplier credit opening balance posts to payables against opening equity",()=>{
 const plan=planPartyOpeningBalance({partyKind:"SUPPLIER",balance:-75000});
 assert.equal(plan.debitRial,0);assert.equal(plan.creditRial,75000);
 assert.deepEqual(plan.journal.map(x=>[x.accountCode,x.debitRial,x.creditRial]),[["3102",75000,0],["2101",0,75000]]);
});

test("supplier debit and customer credit balances use the appropriate control account",()=>{
 assert.equal(planPartyOpeningBalance({partyKind:"SUPPLIER",balance:500}).journal[0].accountCode,"2101");
 assert.equal(planPartyOpeningBalance({partyKind:"CUSTOMER",balance:-500}).journal[1].accountCode,"1103");
});

test("zero opening balance creates no accounting journal",()=>{
 assert.deepEqual(planPartyOpeningBalance({partyKind:"BOTH",balance:0}).journal,[]);
});

test("opening balance planner rejects unsupported party kinds and fractional rial values",()=>{
 assert.throws(()=>planPartyOpeningBalance({partyKind:"OTHER",balance:100}),/نوع طرف حساب/);
 assert.throws(()=>planPartyOpeningBalance({partyKind:"CUSTOMER",balance:1.5}),/عدد صحیح/);
});
