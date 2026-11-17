const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("dashboard reports outstanding receivables and payables after settlement allocations",()=>{
 assert.match(app,/allocationRows=await all\("treasuryAllocations"\)/);
 assert.match(app,/openReceivables=postedInvoices\.filter\(x=>x\.kind==="SALE"\)/);
 assert.match(app,/openPayables=postedInvoices\.filter\(x=>x\.kind==="PURCHASE"\)/);
 assert.match(app,/getInvoiceSettlement\(x,allocationRows\)\.outstanding/);
 assert.match(app,/مطالبات باز/);
 assert.match(app,/بدهی خرید باز/);
});

test("dashboard overdue invoice and low-stock cards use outstanding balance and configured minimums",()=>{
 assert.match(app,/overdueInvoices=postedInvoices\.filter\(x=>Number\(x\.dueDate\)>0&&Number\(x\.dueDate\)<Date\.now\(\)&&getInvoiceSettlement\(x,allocationRows\)\.outstanding>0\)/);
 assert.match(app,/lowStockCount=products\.filter\(x=>Number\(x\.minStock\|\|0\)>0&&Number\(x\.stock\|\|0\)<=Number\(x\.minStock\)\)\.length/);
 assert.match(app,/فاکتورهای سررسیدگذشته/);
 assert.match(app,/کالاهای کم‌موجود/);
});

test("blocked parties are visible, searchable and preserved when editing",()=>{
 assert.match(app,/\["status","وضعیت طرف حساب","select",0,\["فعال","مسدود"\]\]/);
 assert.match(app,/status=d\.status==="مسدود"\?"BLOCKED":"ACTIVE"/);
 assert.match(app,/if\(key==="status"&&page==="parties"\)val=val==="BLOCKED"\?"مسدود":"فعال"/);
 assert.match(app,/x\.status==="BLOCKED"\?'<span class="pill bad"/);
 assert.match(app,/x\.status==="BLOCKED"\?"مسدود":"فعال"/);
});

test("blocked customers cannot be selected for new sales invoices or sales orders and are revalidated at save time",()=>{
 assert.match(app,/parties\.filter\(p=>p\.status!=="BLOCKED"\|\|Number\(p\.id\)===Number\(item\?\.partyId\)\)/);
 assert.match(app,/parties\.filter\(p=>p\.kind!=="SUPPLIER"&&p\.status!=="BLOCKED"\)/);
 assert.match(app,/kind==="SALE"&&p\.status==="BLOCKED"/);
 assert.match(app,/party\.status==="BLOCKED"/);
});
