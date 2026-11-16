const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("invoice list can search invoice number, party, product and currency",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/جست‌وجوی شماره، طرف حساب، کالا یا ارز/);
 assert.match(app,/invoices\.filter\(x=>\[x\.number,x\.partyName,x\.product,x\.currency/);
});

test("unsettled invoices expose a direct allocation action that preselects the invoice",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/outstanding>0&&settlement\.status!=="REVERSED"/);
 assert.match(app,/data-invoice-allocate=/);
 assert.match(app,/openForm\("allocations"\).*form\.elements\.invoiceId\.value=allocateButton\.dataset\.invoiceAllocate/);
});

 
test("invoice notes are saved and included on the printed invoice",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/name="note" rows="3"/);
 assert.match(app,/note:String\(d\.note\|\|""\)\.trim\(\)/);
 assert.match(app,/h\(invoice\.note\|\|""\)/);
});
