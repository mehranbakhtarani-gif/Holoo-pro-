"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
const foreignPayables=require("../foreign-payables.js");
const reversalValidation=require("../reversal-validation.js");
globalThis.HolooReversalValidation=reversalValidation;

function extract(startText,endText){
 const start=app.indexOf(startText),end=app.indexOf(endText,start);
 if(start<0||end<=start)throw Error("Source function not found: "+startText);
 return app.slice(start,end);
}
const validatorSource=extract("function validateReversalVoucherLines(","\nfunction applyPartyBalanceDelta");
function baseDb(accountCode="2101"){
 return {
  treasury:[{id:1,kind:"PAYMENT",method:"بانک",partyId:3,amount:100,reference:"TREASURY:1"}],
  parties:[{id:3,name:"Supplier",kind:"SUPPLIER",balance:100}],
  vouchers:[{id:10,reference:"TREASURY:1"}],
  voucherLines:[{voucherId:10,accountCode,debitRial:100,creditRial:0},{voucherId:10,accountCode:"1102",debitRial:0,creditRial:100}],
  treasuryAllocations:[],
  importChargePayables:[],
  accounts:["1101","1102","1103","2101","2102","4301","5501","5502"].map(id=>({id}))
 };
}
function treasuryHarness(accountCode="2101"){
 const db=baseDb(accountCode);let written=null;
 const all=async store=>(db[store]||[]).map(row=>({...row}));
 const applyPartyBalanceDelta=(party,delta)=>{party.balance+=delta};
 const postVoucherAtomic=async(...args)=>{written=args};
 const fn=new Function("all","applyPartyBalanceDelta","postVoucherAtomic",validatorSource+";"+extract("async function reverseTreasuryPwa(id){","\nasync function reconcileLegacyImportChargePwa")+";return reverseTreasuryPwa;")(all,applyPartyBalanceDelta,postVoucherAtomic);
 return {db,fn,get written(){return written}};
}
function checkHarness(accountCode="1102"){
 const db={
  checks:[{id:1,status:"CLEARED",kind:"RECEIVED",partyId:3,amount:100,number:"CH-1"}],
  parties:[{id:3,name:"Customer",kind:"CUSTOMER",balance:-100}],
  treasury:[{id:5,kind:"RECEIPT",method:"بانک",partyId:3,amount:100,checkId:1,reference:"CHECK:CLEAR:1"}],
  vouchers:[{id:9,reference:"CHECK:CLEAR:1"}],
  voucherLines:[{voucherId:9,accountCode,debitRial:100,creditRial:0},{voucherId:9,accountCode:"1103",debitRial:0,creditRial:100}],
  treasuryAllocations:[],
  accounts:["1101","1102","1103","2101"].map(id=>({id}))
 };
 let written=null;
 const all=async store=>(db[store]||[]).map(row=>({...row}));
 const applyPartyBalanceDelta=(party,delta)=>{party.balance+=delta};
 const postVoucherAtomic=async(...args)=>{written=args};
 const fn=new Function("all","applyPartyBalanceDelta","postVoucherAtomic",validatorSource+";"+extract("async function reverseClearedCheckPwa(id){","\nasync function reverseTreasuryPwa")+";return reverseClearedCheckPwa;")(all,applyPartyBalanceDelta,postVoucherAtomic);
 return {db,fn,get written(){return written}};
}
function foreignHarness(fxAccount="5501"){
 const payment={id:9,payableId:5,sourceNumber:"S7",supplierId:3,supplierName:"Supplier",currency:"USD",amountMinor:500,fxRateRialPerUnit:120,bookedRial:500,settlementRial:600,fxGainRial:0,fxLossRial:100,date:1,reference:"FXPAY:S7:1",method:"بانک",status:"POSTED"};
 const db={
  foreignPayablePayments:[payment],
  foreignPayables:[{id:5,sourceShipmentId:7,sourceNumber:"S7",supplierId:3,supplierName:"Supplier",currency:"USD",amountMinor:1000,paidMinor:500,bookedFxRateRialPerUnit:100,bookedRial:1000,bookedRialPaid:500,settlementRialPaid:600,realizedFxGainRial:0,realizedFxLossRial:100,status:"PARTIAL"}],
  parties:[{id:3,name:"Supplier",kind:"SUPPLIER",balance:500}],
  importShipments:[{id:7,status:"رسید انبار شده"}],
  treasury:[{id:11,kind:"PAYMENT",method:"بانک",partyId:3,amount:600,foreignAmountMinor:500,foreignPayableId:5,reference:payment.reference}],
  vouchers:[{id:12,reference:payment.reference}],
  voucherLines:[{voucherId:12,accountCode:"2101",debitRial:500,creditRial:0},{voucherId:12,accountCode:"1102",debitRial:0,creditRial:600},{voucherId:12,accountCode:fxAccount,debitRial:100,creditRial:0}],
  accounts:["2101","1101","1102","4301","5501","5502"].map(id=>({id})),
  partyLedger:[{partyId:3,referenceId:payment.reference,debitRial:500,creditRial:0}]
 };
 let written=null;
 const all=async store=>(db[store]||[]).map(row=>({...row}));
 const ensureBaseAccounts=async()=>{};
 const postVoucherAtomic=async(...args)=>{written=args};
 const fn=new Function("all","HolooForeignPayables","ensureBaseAccounts","postVoucherAtomic","applyPartyBalanceDelta",validatorSource+";"+extract("async function reverseForeignPayablePaymentPwa(id){","\nasync function exportBackup")+";return reverseForeignPayablePaymentPwa;")(all,foreignPayables,ensureBaseAccounts,postVoucherAtomic,(party,delta)=>{party.balance+=delta});
 return {db,fn,get written(){return written}};
}

test("reversal validator returns the exact inverse and rejects balanced wrong-account lines",()=>{
 const validate=new Function(validatorSource+";return validateReversalVoucherLines;")();
 const accounts=[{id:"2101"},{id:"1102"},{id:"1101"}];
 const inverse=validate({voucher:{id:1},lines:[{voucherId:1,accountCode:"2101",debitRial:100,creditRial:0},{voucherId:1,accountCode:"1102",debitRial:0,creditRial:100}],accounts,expectedLines:[{accountCode:"2101",debitRial:100,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:100}],expectedTotal:100});
 assert.deepEqual(inverse.map(x=>[x.accountCode,x.debitRial,x.creditRial]),[["2101",0,100],["1102",100,0]]);
 assert.throws(()=>validate({voucher:{id:1},lines:[{voucherId:1,accountCode:"1101",debitRial:100,creditRial:0},{voucherId:1,accountCode:"1102",debitRial:0,creditRial:100}],accounts,expectedLines:[{accountCode:"2101",debitRial:100,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:100}]}),/حساب یا مبلغ/);
});

test("treasury reversal refuses a balanced voucher posted to the wrong party account",async()=>{
 const h=treasuryHarness("1103");
 await assert.rejects(h.fn(1),/حساب یا مبلغ/);
 assert.equal(h.written,null);
});

test("treasury reversal accepts the exact source journal and writes its inverse",async()=>{
 const h=treasuryHarness();
 await h.fn(1);
 assert.ok(h.written);
 assert.deepEqual(h.written[2].map(x=>[x.accountCode,x.debitRial,x.creditRial]),[["2101",0,100],["1102",100,0]]);
});

test("cleared-check reversal refuses a balanced voucher with the wrong account",async()=>{
 const h=checkHarness("2101");
 await assert.rejects(h.fn(1),/حساب یا مبلغ/);
 assert.equal(h.written,null);
});

test("foreign payable reversal validates the FX account and amount line by line",async()=>{
 const h=foreignHarness("5502");
 await assert.rejects(h.fn(9),/حساب یا مبلغ/);
 assert.equal(h.written,null);
});

test("foreign payable reversal accepts the exact source FX journal",async()=>{
 const h=foreignHarness();
 await h.fn(9);
 assert.ok(h.written);
 assert.deepEqual(h.written[2].map(x=>[x.accountCode,x.debitRial,x.creditRial]),[["2101",0,500],["1102",600,0],["5501",0,100]]);
});

test("invoice and manual voucher reversal paths use the same strict validator",()=>{
 assert.match(app,/reverseVoucherLines=validateReversalVoucherLines\(\{voucher:original,lines:oldLines,accounts,label:"فاکتور "/);
 assert.match(app,/validateReversalVoucherLines\(\{voucher:original,lines,accounts,label:"سند دستی"\}\)/);
});
