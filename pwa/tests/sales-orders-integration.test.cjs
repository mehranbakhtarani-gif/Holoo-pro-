const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
test("sales quote and order store is included in database migration",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/DB_VERSION=9/);
 assert.match(app,/"salesOrders"/);
 assert.match(app,/salesOrders:\["پیش‌فاکتور و سفارش"/);
});
test("sales orders can be drafted, approved, cancelled and converted only after approval",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/status!=="APPROVED"\)throw Error\("فقط سفارش تأییدشده قابل تبدیل به فاکتور است"\)/);
 assert.match(app,/if\(next==="APPROVED"\)/);
 assert.match(app,/if\(next==="CANCELLED"\)/);
 assert.match(app,/data-order-action="APPROVED"/);
 assert.match(app,/data-order-action="INVOICE"/);
 assert.match(app,/status:"INVOICED"/);
});
test("quotes and orders do not change inventory until invoice posting",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 const start=app.indexOf('if(page==="salesOrders"){',app.indexOf("async function saveForm"));
 const end=app.indexOf('if(page==="invoices"){',start);
 const save=app.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(save,/await put\("salesOrders"/);
 assert.doesNotMatch(save,/warehouseStock|postVoucherAtomic|product\.stock/);
});
test("invoice conversion carries the approved order ID and exact commercial terms",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/name="orderId"/);
 assert.match(app,/form\.elements\.orderId\.value=String\(order\.id\)/);
 assert.match(app,/linkedOrder\.status!=="APPROVED"/);
 assert.match(app,/شرایط مالی فاکتور با سفارش تأییدشده مطابقت ندارد/);
 assert.match(app,/ردیف‌های فاکتور با سفارش تأییدشده یکسان نیستند/);
});
test("sales order page exposes edit, approval, cancellation and invoice actions",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/if\(currentPage==="salesOrders"\)/);
 assert.match(app,/data-edit="salesOrders:/);
 assert.match(app,/data-order-action="CANCELLED"/);
 assert.match(app,/bindSalesOrders\(\)/);
});
test("invoice price tier initialization runs after its callback is declared",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 const start=app.indexOf('if(page==="invoices"){',app.indexOf("async function openForm"));
 const fn=app.indexOf("const updateTierPrice=row=>",start);
 const call=app.indexOf('rows.querySelectorAll(".invoice-line-row").forEach(updateTierPrice);',fn);
 assert.ok(start>=0&&fn>start&&call>fn);
 assert.doesNotMatch(app,/typeof updateTierPrice==="function"/);
});
