const test=require("node:test");
const assert=require("node:assert/strict");
const {calculatePartyStatement}=require("../party-statement.js");

test("party statement displays opening balance once and excludes its technical ledger entry",()=>{
 const rows=calculatePartyStatement({id:7,balance:125000},[
  {id:1,partyId:7,date:100,debitRial:125000,creditRial:0,description:"مانده افتتاحیه",referenceId:"OPENING:PARTY:7"}
 ]);
 assert.equal(rows.length,1);
 assert.deepEqual(rows[0],{opening:true,date:null,description:"مانده افتتاحیه",debitRial:125000,creditRial:0,balance:125000});
});

test("party statement calculates running balances from opening balance and later movements",()=>{
 const rows=calculatePartyStatement({id:7,balance:105000},[
  {id:1,partyId:7,date:100,debitRial:125000,creditRial:0,description:"مانده افتتاحیه",referenceId:"OPENING:PARTY:7"},
  {id:2,partyId:7,date:200,debitRial:30000,creditRial:0,description:"فاکتور فروش"},
  {id:3,partyId:7,date:300,debitRial:0,creditRial:50000,description:"دریافت وجه"}
 ]);
 assert.deepEqual(rows.map(row=>row.balance),[125000,155000,105000]);
 assert.deepEqual(rows.map(row=>row.description),["مانده افتتاحیه","فاکتور فروش","دریافت وجه"]);
});

test("party statement supports supplier credit opening balance",()=>{
 const rows=calculatePartyStatement({id:8,balance:-75000},[
  {id:1,partyId:8,date:100,debitRial:0,creditRial:75000,description:"مانده افتتاحیه",referenceId:"OPENING:PARTY:8"}
 ]);
 assert.equal(rows[0].creditRial,75000);
 assert.equal(rows[0].balance,-75000);
});

test("party statement rejects invalid fractional or opposing debit-credit movements",()=>{
 assert.throws(()=>calculatePartyStatement({id:1,balance:100},[{partyId:1,debitRial:1.5,creditRial:0}]),/نامعتبر/);
 assert.throws(()=>calculatePartyStatement({id:1,balance:100},[{partyId:1,debitRial:10,creditRial:10}]),/نامعتبر/);
});
