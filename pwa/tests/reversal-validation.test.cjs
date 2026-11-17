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
 assert.throws(()=>validateReversalVoucherLines({voucher,lines:[originalLines[0],{...originalLines[1],voucherId:8}],accounts,label:"شناسه سند"}),/به سند اصلی متصل نیست/);
 assert.throws(()=>validateReversalVoucherLines({voucher,lines:[originalLines[0],{...originalLines[1],voucherId:undefined}],accounts,label:"مرجع خالی"}),/به سند اصلی متصل نیست/);
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

const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
const index=fs.readFileSync(path.resolve(__dirname,"../index.html"),"utf8");
const sw=fs.readFileSync(path.resolve(__dirname,"../sw.js"),"utf8");

test("all journal reversal paths use the shared validator and PWA loads and caches it",()=>{
 assert.match(app,/function validateReversalVoucherLines\(args\)/);
 for(const route of ["reverseClearedCheckPwa","reverseTreasuryPwa","reverseTreasuryAllocationPwa","reversePwaInvoice","reverseForeignPayablePaymentPwa"])assert.ok(app.includes("function "+route+"("),route+" must remain present");
 assert.ok(app.includes('validateReversalVoucherLines({voucher,lines:oldLines,accounts,expectedLines,expectedTotal:amount,label:"وصول چک"})'));
 assert.ok(app.includes('validateReversalVoucherLines({voucher,lines:oldLines,accounts,expectedLines,expectedTotal:amount,label:"خزانه"})'));
 assert.ok(app.includes('validateReversalVoucherLines({voucher:original,lines:oldLines,accounts,expectedLines:expectedFxLines,expectedTotal:gain+loss,label:"تسعیر تخصیص"})'));
 assert.ok(app.includes('validateReversalVoucherLines({voucher:original,lines:oldLines,accounts,label:"فاکتور "+invoice.number})'));
 assert.ok(app.includes('validateReversalVoucherLines({voucher:originalVoucher,lines:oldLines,accounts,expectedLines,expectedTotal:plan.settlementRial+plan.fxGainRial,label:"پرداخت تعهد ارزی"})'));
 assert.ok(app.includes('validateReversalVoucherLines({voucher:original,lines,accounts,label:"سند دستی"})'));
 assert.ok(index.indexOf("reversal-validation.js")<index.indexOf("app.js?v=reversal-integrity-3"));
 assert.match(sw,/reversal-validation\\.js/);
 assert.match(sw,/holloo-pwa-v168-reversal-row-validation/);
});
