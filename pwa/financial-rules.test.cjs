"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const rules=require("./financial-rules.js");

test("accepts a receipt up to the customer's debit balance",()=>{
 assert.equal(rules.validateTreasurySettlement({kind:"RECEIPT",amount:400,balance:500,method:"بانک",partyKind:"CUSTOMER"}),true);
});
test("rejects receipt above debit balance",()=>{
 assert.throws(()=>rules.validateTreasurySettlement({kind:"RECEIPT",amount:501,balance:500,method:"صندوق",partyKind:"CUSTOMER"}),/بیشتر است/);
});
test("accepts payment up to supplier payable balance",()=>{
 assert.equal(rules.validateTreasurySettlement({kind:"PAYMENT",amount:400,balance:-500,method:"صندوق",partyKind:"SUPPLIER"}),true);
});
test("rejects payment above supplier payable balance",()=>{
 assert.throws(()=>rules.validateTreasurySettlement({kind:"PAYMENT",amount:501,balance:-500,method:"بانک",partyKind:"SUPPLIER"}),/بیشتر است/);
});
test("rejects invalid method, amount and wrong party direction",()=>{
 assert.throws(()=>rules.validateTreasurySettlement({kind:"RECEIPT",amount:1.5,balance:10,method:"بانک",partyKind:"CUSTOMER"}));
 assert.throws(()=>rules.validateTreasurySettlement({kind:"PAYMENT",amount:1,balance:-10,method:"کارت",partyKind:"SUPPLIER"}));
 assert.throws(()=>rules.validateTreasurySettlement({kind:"RECEIPT",amount:1,balance:10,method:"بانک",partyKind:"SUPPLIER"}));
});
test("protects posted financial stores from physical deletion",()=>{
 for(const store of ["invoices","vouchers","voucherLines","treasury","partyLedger","stockAdjustments"])assert.equal(rules.isProtectedFinancialStore(store),true);
 assert.equal(rules.isProtectedFinancialStore("products"),false);
});
test("resolves account code from the account id",()=>{
 assert.equal(rules.accountKey({id:"1101",title:"صندوق"}),"1101");
 assert.equal(rules.accountKey({code:"1102"}),"1102");
});
