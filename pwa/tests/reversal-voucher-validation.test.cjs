const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
const start=app.indexOf("function validateReversalVoucherLines(");
const end=app.indexOf("function applyPartyBalanceDelta(",start);
assert.ok(start>=0&&end>start);
const validate=new Function(app.slice(start,end)+";return validateReversalVoucherLines;")();

test("reversal lines are exact inverses of the validated original journal",()=>{
 const result=validate({voucher:{id:1},accounts:[{id:"2101"},{id:"1102"}],lines:[{accountCode:"2101",debitRial:100,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:100}],expectedLines:[{accountCode:"2101",debitRial:100,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:100}],expectedTotal:100,label:"test"});
 assert.deepEqual(result.map(x=>[x.accountCode,x.debitRial,x.creditRial]),[["2101",0,100],["1102",100,0]]);
});
test("balanced but wrong account or amount is rejected when the operation defines expected lines",()=>{
 assert.throws(()=>validate({voucher:{id:1},accounts:[{id:"2101"},{id:"1102"},{id:"1103"}],lines:[{accountCode:"1103",debitRial:100,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:100}],expectedLines:[{accountCode:"2101",debitRial:100,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:100}],expectedTotal:100}),/حساب یا مبلغ/);
 assert.throws(()=>validate({voucher:{id:1},accounts:[{id:"2101"},{id:"1102"}],lines:[{accountCode:"2101",debitRial:90,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:90}],expectedTotal:100}),/با مبلغ عملیات/);
});
test("unknown accounts, malformed lines and unsafe totals fail closed",()=>{
 assert.throws(()=>validate({voucher:{id:1},accounts:[{id:"1102"}],lines:[{accountCode:"9999",debitRial:10,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:10}]}),/کد حساب/);
 assert.throws(()=>validate({voucher:{id:1},accounts:[{id:"1102"}],lines:[{accountCode:"1102",debitRial:10,creditRial:10},{accountCode:"1102",debitRial:0,creditRial:10}]}),/مبلغ یا ماهیت/);
 assert.throws(()=>validate({voucher:{id:1},accounts:[{id:"1102"}],lines:[{accountCode:"1102",debitRial:Number.MAX_SAFE_INTEGER,creditRial:0},{accountCode:"1102",debitRial:0,creditRial:Number.MAX_SAFE_INTEGER}],expectedTotal:Number.MAX_SAFE_INTEGER+1}),/مبلغ عملیات/);
});
test("treasury, cheque, foreign payment, allocation and invoice reversals use journal validation",()=>{
 assert.match(app,/validateReversalVoucherLines\(\{voucher,lines:oldLines,accounts,expectedLines,expectedTotal:amount,label:"خزانه"\}\)/);
 assert.match(app,/validateReversalVoucherLines\(\{voucher,lines:oldLines,accounts,expectedLines,expectedTotal:amount,label:"وصول چک"\}\)/);
 assert.match(app,/validateReversalVoucherLines\(\{voucher:original,lines:oldLines,accounts,expectedTotal:gain\+loss,label:"تسعیر تخصیص"\}\)/);
 assert.match(app,/validateReversalVoucherLines\(\{voucher:originalVoucher,lines:oldLines,accounts,expectedLines,expectedTotal:plan\.settlementRial\+plan\.fxGainRial,label:"پرداخت تعهد ارزی"\}\)/);
 assert.match(app,/validateReversalVoucherLines\(\{voucher:original,lines:oldLines,accounts,label:"فاکتور "\+invoice\.number\}\)/);
});
