const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

test("sales orders page has one authoritative renderer and keeps operation-date controls",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.equal(app.split('if(currentPage==="salesOrders")').length-1,1);
 assert.ok(app.includes("bindOperationDateControls()"));
 assert.ok(app.includes("operation-date-bar"));
});


test("sales orders expose working print and CSV export actions",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/data-order-print=/);
 assert.match(app,/printSalesOrderDocument\(button\.dataset\.orderPrint\)/);
 assert.match(app,/id="exportSalesOrdersCsv"/);
 assert.match(app,/holloo-sales-orders\.csv/);
 assert.match(app,/order\.currency==="IRR"\?money\(line\.price\):fmtForeign\(line\.price\)/);
});


test("sales order search includes item names, amounts, currency and dates",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/جست‌وجوی شماره، مشتری، کالا، انبار، مبلغ، تاریخ یا وضعیت/);
 assert.match(app,/\.\.\.\(Array\.isArray\(x\.lines\)\?x\.lines\.flatMap\(line=>\[line\.productName,line\.productId,line\.qty\]\):\[\]\)/);
 assert.match(app,/x\.currency,x\.invoiceNumber,date\(x\.createdAt\),date\(x\.validUntil\),x\.total,fmt\(x\.total\|\|0\)/);
});
