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
test("custom fields are exposed in invoice and order printouts and CSV exports",()=>{
 assert.match(app,/customDefs\.map\(d=>'<th>'\+h\(d\.label\)/);
 assert.match(app,/customDefs\.map\(d=>d\.label\)/);
 assert.match(app,/line\.customFields\?\.\[d\.key\]/);
});
test("service worker caches and network-refreshes the custom fields module",()=>{
 assert.match(sw,/"\.\/custom-fields\.js"/);
 assert.match(sw,/custom-fields\\\.js/);
});
test("user-defined fields are validated and never evaluated as executable code",()=>{
 assert.match(custom,/allowed=new Set\(\["text","number","date","select","checkbox"\]\)/);
 assert.match(custom,/\^\[a-zA-Z\]\[a-zA-Z0-9_\]/);
 assert.doesNotMatch(custom,/eval\s*\(|new Function\s*\(/);
});
