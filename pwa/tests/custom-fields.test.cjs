const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const app=read("app.js"),custom=read("custom-fields.js"),html=read("index.html"),sw=read("sw.js");
test("custom fields module loads before the main PWA app",()=>{
 const customAt=html.indexOf('src="./custom-fields.js');
 const appAt=html.indexOf('src="./app.js');
 assert.ok(customAt>=0&&appAt>customAt);
});
test("custom fields use the existing IndexedDB audit store without schema migration",()=>{
 assert.match(app,/DB_VERSION=11/);
 assert.match(app,/"auditLog"/);
 assert.match(custom,/CONFIG_ID="__HOLLOO_CUSTOM_FIELDS_V1__"/);
 assert.match(custom,/db\.transaction\(STORE,"readwrite"\)/);
});
test("invoice and sales-order line fields are collected and persisted",()=>{
 assert.match(custom,/#invoiceLineRows \.invoice-line-row,#orderLineRows \.invoice-line-row/);
 assert.match(app,/lineCustomFields=JSON\.parse\(data\.__customLineFields\|\|"\[\]"\)/);
 assert.match(app,/customFields:globalThis\.HolooCustomFields\?\.normalizeLineValues/);
});
test("existing custom values survive disabled or removed field definitions",()=>{
 assert.match(custom,/const out=values&&typeof values==="object"&&!Array\.isArray\(values\)\?\{\.\.\.values\}:\{\}/);
 assert.match(custom,/row\.dataset\.customValues/);
});
test("sales-order list and print paths include custom line fields",()=>{
 assert.match(custom,/async function enhanceSalesOrdersTable/);
 assert.match(app,/customFields:globalThis\.HolooCustomFields\?\.normalizeLineValues/);
 assert.match(app,/customDefs\.map\(d=>'<th>'\+h\(d\.label\)/);
});
test("approved order conversion carries custom line values into the invoice form",()=>{
 assert.match(app,/row\.dataset\.customValues=JSON\.stringify\(line\.customFields\|\|\{\}\)/);
 assert.match(app,/async function convertSalesOrderToInvoice/);
});
test("custom fields are exposed in invoice and order printouts and CSV exports",()=>{
 assert.match(app,/customDefs\.map\(d=>'<th>'\+h\(d\.label\)/);
 assert.match(app,/customDefs\.map\(d=>d\.label\)/);
 assert.match(app,/line\.customFields\?\.\[d\.key\]/);
});
test("service worker caches and network-refreshes the custom fields module and invalidates prior cache",()=>{
 assert.match(sw,/holloo-pwa-v134-custom-fields/);
 assert.match(sw,/"\.\/custom-fields\.js"/);
 assert.match(sw,/custom-fields\\\.js/);
});
test("user-defined fields are validated and never evaluated as executable code",()=>{
 assert.match(custom,/allowed=new Set\(\["text","number","date","select","checkbox"\]\)/);
 assert.match(custom,/\^\[a-zA-Z\]\[a-zA-Z0-9_\]/);
 assert.doesNotMatch(custom,/eval\s*\(|new Function\s*\(/);
});

test("required checkbox accepts an explicit false value",()=>{
 assert.match(custom,/if\(d\.required&&\(v===""\|\|v===null\|\|v===undefined\)\)/);
 assert.doesNotMatch(custom,/d\.required&&\(v===""\|\|v===false\)/);
});
test("custom date fields reject malformed and impossible calendar dates",()=>{
 assert.match(custom,/d\.type==="date"&&v!==""/);
 assert.match(custom,/new Date\(Number\(m\[1\]\),Number\(m\[2\]\)-1,Number\(m\[3\]\)\)\.toISOString\(\)\.slice\(0,10\)!==v/);
});
test("customization config records are not shown as user audit events",()=>{
 assert.match(app,/filter\(x=>x\.id!=="__HOLLOO_CUSTOM_FIELDS_V1__"&&x\.action!=="CUSTOMIZATION_CONFIG"\)/);
});
