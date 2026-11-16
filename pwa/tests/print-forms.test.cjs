const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
test("invoice print action is available on invoice rows",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/class="ghost invoice-print"/);
 assert.match(app,/printInvoiceDocument\(printButton\.dataset\.invoice\)/);
});
test("invoice print sheet contains invoice lines, bonus quantities, discounts and totals",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/async function printInvoiceDocument/);
 assert.match(app,/line\.bonusQty/);
 assert.match(app,/line\.discountRial/);
 assert.match(app,/invoice\.foreignTotalMinor/);
 assert.match(app,/window\.print\(\)/);
});
test("cheque receipt printing includes cheque identifiers, bank, issue and due dates",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/async function printCheckDocument/);
 assert.match(app,/data-check-print/);
 assert.match(app,/check\.number/);
 assert.match(app,/check\.bank/);
 assert.match(app,/check\.issue/);
 assert.match(app,/check\.due/);
});
test("print actions use popup synchronously from click and open browser print dialog",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/window\.open\("","_blank"/);
 assert.match(app,/popup\.print\(\)/);
 assert.match(app,/setTimeout\(\(\)=>popup\.print\(\),700\)/);
});

 
test("check receipt printing has one authoritative implementation",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.equal(app.split("async function printCheckDocument(id)").length-1,1);
});

 
test("invoice printing uses one configurable template-aware implementation",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.equal(app.split("async function printInvoiceDocument(number)").length-1,1);
 const start=app.indexOf("async function printInvoiceDocument(number)");
 const end=app.indexOf("async function printCheckDocument(id)",start);
 const printer=app.slice(start,end);
 assert.ok(printer.includes("getInvoicePrintTemplate"));
 assert.ok(printer.includes("getDefinitions(\"invoices\")"));
 assert.ok(printer.includes("template.footerNote"));
});
