const test=require("node:test");
const assert=require("node:assert/strict");
const {validateReversalVoucherLines,validateReversalVoucherPair}=require("../reversal-validation.js");

const accounts=[{id:"1101"},{id:"1102"},{id:"1103"},{id:"1301"},{id:"5202"}];
const voucher={id:7,reference:"TREASURY:7"};
const originalLines=[
 {id:1,voucherId:7,accountCode:"1102",debitRial:1250,creditRial:0},
 {id:2,voucherId:7,accountCode:"1103",debitRial:0,creditRial:1250}
];
const validReverse=[
 {accountCode:"1102",debitRial:0,creditRial:1250},
 {accountCode:"1103",debitRial:1250,creditRial:0}
];

test("validates an exact row-by-row reversal and preserves row count",()=>{
 const result=validateReversalVoucherLines({voucher,lines:originalLines,accounts,expectedTotal:1250,label:"آزمون"});
 assert.equal(result.length,originalLines.length);
 assert.deepEqual(result.map(({accountCode,debitRial,creditRial})=>({accountCode,debitRial,creditRial})),validReverse);
 assert.equal(validateReversalVoucherPair({originalLines,reversalLines:validReverse,label:"آزمون"}),true);
});

test("rejects a balanced reversal that uses the wrong account",()=>{
 const wrong=validReverse.map(row=>({...row}));
 wrong[0].accountCode="1101";
 assert.throws(()=>validateReversalVoucherPair({originalLines,reversalLines:wrong,label:"حساب اشتباه"}),/ردیف شماره 1/);
});

test("rejects a balanced reversal with a wrong row amount",()=>{
 const wrong=[{...validReverse[0],creditRial:1200},{...validReverse[1],debitRial:1200}];
 assert.throws(()=>validateReversalVoucherPair({originalLines,reversalLines:wrong,label:"مبلغ اشتباه"}),/ردیف شماره 1/);
});

test("rejects extra, missing, duplicated and reordered reversal rows",()=>{
 assert.throws(()=>validateReversalVoucherPair({originalLines,reversalLines:[...validReverse,validReverse[0]],label:"ردیف اضافه"}),/تعداد ردیف‌ها/);
 assert.throws(()=>validateReversalVoucherPair({originalLines,reversalLines:validReverse.slice(0,1),label:"ردیف مفقود"}),/تعداد ردیف‌ها/);
 assert.throws(()=>validateReversalVoucherPair({originalLines,reversalLines:[validReverse[0],validReverse[0]],label:"ردیف تکراری"}),/ردیف شماره 2/);
 assert.throws(()=>validateReversalVoucherPair({originalLines,reversalLines:[validReverse[1],validReverse[0]],label:"ترتیب اشتباه"}),/ردیف شماره 1/);
});

test("rejects source lines attached to another voucher or duplicate source line ids",()=>{
 assert.throws(()=>validateReversalVoucherLines({voucher,lines:[originalLines[0],{...originalLines[1],voucherId:8}],accounts,label:"شناسه سند"}),/به سند دیگری متصل است/);
 assert.throws(()=>validateReversalVoucherLines({voucher,lines:[originalLines[0],{...originalLines[1],id:1}],accounts,label:"شناسه ردیف"}),/شناسه ردیف.*تکراری/);
});

test("rejects unknown accounts, unbalanced sources and mismatched expected accounts",()=>{
 assert.throws(()=>validateReversalVoucherLines({voucher,lines:[originalLines[0],{...originalLines[1],accountCode:"9999"}],accounts,label:"حساب ناشناخته"}),/کد حساب 9999/);
 assert.throws(()=>validateReversalVoucherLines({voucher,lines:[originalLines[0],{...originalLines[1],creditRial:1000}],accounts,label:"سند نامتوازن"}),/تراز یا معتبر نیست/);
 assert.throws(()=>validateReversalVoucherLines({voucher,lines:originalLines,accounts,expectedLines:[{accountCode:"1101",debitRial:1250,creditRial:0},{accountCode:"1103",debitRial:0,creditRial:1250}],label:"حساب مرجع"}),/با عملیات مرجع مطابقت ندارد/);
});

test("purchase reversal accepts only its explicit balanced inventory-cost adjustment rows",()=>{
 const adjustment=[
  {accountCode:"1301",debitRial:0,creditRial:50},
  {accountCode:"5202",debitRial:50,creditRial:0}
 ];
 assert.equal(validateReversalVoucherPair({originalLines,reversalLines:[...validReverse,...adjustment],additionalLines:adjustment,label:"برگشت خرید"}),true);
 assert.throws(()=>validateReversalVoucherPair({originalLines,reversalLines:[...validReverse,{...adjustment[0],creditRial:51},adjustment[1]],additionalLines:adjustment,label:"تعدیل نامعتبر"}),/تعدیلی اضافه/);
 assert.throws(()=>validateReversalVoucherPair({originalLines,reversalLines:[...validReverse,...adjustment,{accountCode:"1101",debitRial:1,creditRial:0}],additionalLines:adjustment,label:"ردیف غیرمجاز"}),/تعداد ردیف‌ها/);
});
