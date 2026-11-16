const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("shipment status follows a forward-only order to transit to arrived lifecycle",()=>{
 assert.match(app,/const shipmentStages=\{"سفارش":0,"در حال حمل":1,"رسیده":2\}/);
 assert.match(app,/shipmentStages\[record\.status\]<shipmentStages\[current\.status\|\|"سفارش"\]/);
 assert.match(app,/وضعیت محموله فقط می‌تواند به مرحله بعدی پیش برود/);
 assert.match(app,/if\(!\["سفارش","در حال حمل","رسیده"\]\.includes\(d\.status\|\|"سفارش"\)\)/);
 assert.match(app,/parseDateOnlyLocal\(d\.dueDate,"سررسید پرداخت محموله"\)/);
});

test("approval requests must reference an existing matching document and cannot be duplicated by stage",()=>{
 assert.match(app,/function putApprovalGuarded\(record,expected=null\)/);
 assert.match(app,/db\.transaction\(\["approvals",refStore,"auditLog"\],"readwrite"\)/);
 assert.match(app,/row\.number===record\.referenceId&&row\.kind===\(record\.referenceType==="فاکتور فروش"\?"SALE":"PURCHASE"\)/);
 assert.match(app,/String\(row\.id\)===String\(record\.referenceId\)&&row\.kind===\(record\.referenceType==="دریافت"\?"RECEIPT":"PAYMENT"\)/);
 assert.match(app,/برای این سند و مرحله قبلاً درخواست تأیید ثبت شده است/);
 assert.match(app,/status:"در انتظار",note:d\.note/);
 assert.match(app,/درخواست تأیید نهایی‌شده قابل ویرایش نیست/);
});

test("employee master data cannot be edited after payroll history is linked",()=>{
 assert.match(app,/function putEmployeeGuarded\(record,expected=null\)/);
 assert.match(app,/db\.transaction\(\["employees","payroll","auditLog"\],"readwrite"\)/);
 assert.match(app,/payroll\.some\(row=>Number\(row\.employeeId\)===Number\(current\.id\)\)/);
 assert.match(app,/اطلاعات کارمند دارای سابقه حقوق قابل ویرایش نیست/);
 assert.match(app,/parseDateOnlyLocal\(d\.startDate,"تاریخ شروع کارمند"\)/);
 assert.match(app,/await putEmployeeGuarded\(\{id:item\?\.id,name,role:d\.role/);
});
