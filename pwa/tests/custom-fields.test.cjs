const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const app=read("app.js"),custom=read("custom-fields.js"),html=read("index.html"),sw=read("sw.js");
function loadCustom(){const sandbox={window:{},document:{readyState:"loading",addEventListener(){}},console};vm.runInNewContext(custom,sandbox);return sandbox.window.HolooCustomFields;}
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
 assert.match(sw,/holloo-pwa-v140-column-controls/);
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
 assert.match(custom,/dt\.getFullYear\(\)!==y/);
});
test("customization config records are not shown as user audit events",()=>{
 assert.match(app,/filter\(x=>x\.id!=="__HOLLOO_CUSTOM_FIELDS_V1__"&&x\.action!=="CUSTOMIZATION_CONFIG"\)/);
});

test("runtime: required checkbox preserves explicit false",()=>{
 const api=loadCustom();
 const value=api.normalizeLineValues({active:false},[{key:"active",label:"فعال",type:"checkbox",required:true,enabled:true}]);
 assert.equal(value.active,false);
});
test("runtime: custom date validation accepts real dates and rejects impossible dates",()=>{
 const api=loadCustom();
 const defs=[{key:"shipDate",label:"تاریخ ارسال",type:"date",enabled:true}];
 assert.equal(api.normalizeLineValues({shipDate:"2026-11-16"},defs).shipDate,"2026-11-16");
 assert.throws(()=>api.normalizeLineValues({shipDate:"2026-02-30"},defs),/تاریخ/);
 assert.throws(()=>api.normalizeLineValues({shipDate:"16-11-2026"},defs),/تاریخ/);
});
test("runtime: number fields reject non-finite input",()=>{
 const api=loadCustom();
 const defs=[{key:"cartons",label:"تعداد کارتن",type:"number",enabled:true}];
 assert.equal(api.normalizeLineValues({cartons:"12.5"},defs).cartons,12.5);
 assert.throws(()=>api.normalizeLineValues({cartons:"NaN"},defs),/عدد معتبر/);
});

test("entity custom fields are scoped to product and party forms and rows",()=>{
 assert.match(custom,/function enhanceEntityForm\(\)/);
 assert.match(custom,/function enhanceEntityTable\(\)/);
 assert.match(custom,/scope===page/);
 assert.match(app,/customFields:\(\(\)=>\{try\{return \{\.\.\.\(item\?\.customFields\|\|\{\}\),\.\.\.JSON\.parse\(d\.__entityCustomFields\|\|"\{\}"\)\}\}/);
});
test("invoice and order line definitions are separated by document context",()=>{
 assert.match(custom,/getLineDefinitions:page=>definitions\.filter/);
 assert.match(app,/getLineDefinitions\("salesOrders"\)/);
 assert.match(app,/getLineDefinitions\("invoices"\)/);
});
test("date validation uses a real YYYY-MM-DD calendar date",()=>{
 assert.match(custom,/\^\(\\d\{4\}\)-\(\\d\{2\}\)-\(\\d\{2\}\)\$/);
});

test("invoice table columns ignore entity-only custom definitions",()=>{
 assert.match(custom,/definitions\.filter\(x=>x\.enabled&&\(x\.scope\|\|"invoice_line"\)==="invoice_line"&&x\.showInList!==false\)/);
});
test("disabled entity field values survive editing",()=>{
 assert.match(app,/\.\.\.\(item\?\.customFields\|\|\{\}\),\.\.\.JSON\.parse\(d\.__entityCustomFields/);
});
test("entity table enhancement prevents duplicate async column injection",()=>{
 assert.match(custom,/customEntityLoading/);
});

test("custom fields can target warehouses and import shipments",()=>{
 assert.match(custom,/warehouses.*importShipments/);
 assert.match(custom,/\["products","parties","warehouses","importShipments"\]/);
 assert.match(app,/dataset\.currentPage=currentPage/);
});

test("entity custom values are validated before form submission",()=>{
 assert.match(custom,/normalizeLineValues\(vals,definitions\.filter\(d=>d\.enabled&&d\.scope===page\)\)/);
 assert.match(custom,/e\.stopImmediatePropagation\(\)/);
});
test("runtime: required entity fields reject empty values",()=>{
 const api=loadCustom();
 assert.throws(()=>api.normalizeLineValues({serial:""},[{key:"serial",label:"شناسه",type:"text",required:true,enabled:true}]),/الزامی/);
});

test("custom fields support independent list visibility and bounded column width",()=>{
 assert.match(custom,/showInList:d\.showInList!==false/);
 assert.match(custom,/columnWidth:Math\.max\(80,Math\.min\(400/);
 assert.match(custom,/data-cf-list/);
 assert.match(custom,/data-cf-width/);
});
test("print and export custom fields are restricted to matching document scope",()=>{
 assert.match(app,/getDefinitions\("invoices"\)/);
 assert.match(app,/getDefinitions\("salesOrders"\)/);
});

test("settings expose warehouse and import shipment field scopes",()=>{
 assert.match(custom,/value="warehouses">انبار/);
 assert.match(custom,/value="importShipments">محموله وارداتی/);
});
test("custom field list settings expose scope, visibility and column width",()=>{
 assert.match(custom,/data-cf-list/);
 assert.match(custom,/data-cf-width/);
 assert.match(custom,/columnWidth\+"px"/);
});

test("legacy custom field definitions receive safe default column settings",()=>{
 assert.match(custom,/definitions=definitions\.map\(x=>\{try\{return validateDefinition\(x\)\}catch\(_\)\{return null\}\}\)\.filter\(Boolean\)/);
 assert.match(custom,/columnWidth:Math\.max\(80,Math\.min\(400,Number\(d\.columnWidth\)\|\|140\)\)/);
});
test("invoice and order custom column headers apply configured width",()=>{
 assert.ok((custom.match(/th\.style\.width=d\.columnWidth\+"px"/g)||[]).length>=3);
});
