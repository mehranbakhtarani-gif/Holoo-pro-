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
test("invoice print output follows saved template section order, visibility, logo and paper settings",()=>{
 assert.ok(app.includes("getInvoicePrintTemplate"));
 assert.ok(app.includes("template.sections"));
 assert.ok(app.includes("template.visible?.[key]!==false"));
 assert.ok(app.includes("template.logoUrl"));
 assert.ok(app.includes("size:'+paper+' '+orientation"));
});



test("custom fields IndexedDB connection closes on version change and settles blocked opens once",()=>{
 assert.ok(custom.includes("connection.onversionchange=()=>connection.close()"));
 assert.ok(custom.includes("let settled=false"));
 assert.ok(custom.includes("if(settled){connection.close();return}"));
});

test("backup restore refreshes custom field and report definitions from IndexedDB",()=>{
 assert.match(app,/HolooCustomFields\?\.reloadConfig\?\.\(\)/);
 assert.ok(app.includes('"auditLog"'));
 assert.ok(custom.includes("async function reloadConfig()"));
});

test("invoice and order row restoration explicitly rehydrates custom line controls",()=>{
 assert.ok(app.includes("hydrateRow(row,line.customFields||{})"));
 assert.ok(custom.includes("function hydrateRow(row,values)"));
 assert.ok(custom.includes("delete row.dataset.customFieldsReady"));
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
 assert.match(sw,/holloo-pwa-v156-offline-query-fallback/);
 assert.match(sw,/"\.\/custom-fields\.js"/);
 assert.match(sw,/custom-fields\\\.js/);
});
test("user-defined fields are validated and never evaluated as executable code",()=>{
 assert.match(custom,/allowed=new Set\(\["text","number","date","select","checkbox","textarea"\]\)/);
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

test("custom report builder saves reports, previews data and exports CSV/print",()=>{
 assert.match(custom,/REPORT_CONFIG_ID="__HOLLOO_CUSTOM_REPORTS_V1__"/);
 assert.match(custom,/async function saveCustomReport/);
 assert.match(custom,/async function runCustomReport/);
 assert.match(custom,/خروجی CSV/);
 assert.match(custom,/چاپ گزارش/);
});
test("custom report columns use a fixed whitelist and safe text rendering",()=>{
 assert.match(custom,/const reportSchemas=/);
 assert.match(custom,/td\.textContent=value/);
 assert.match(custom,/function safeCsvCell/);
});
test("report configuration is stored separately in the existing audit store",()=>{
 assert.match(custom,/db\.transaction\(STORE,"readwrite"\)/);
 assert.match(custom,/REPORT_CONFIG_ID/);
});

test("custom reports read custom line values from invoice and order line arrays",()=>{
 assert.match(custom,/report\.dataset==="invoices"\|\|report\.dataset==="salesOrders"/);
 assert.match(custom,/row\.lines\|\|\[\]/);
});

test("custom reports render empty date fields as blank, not the Unix epoch",()=>{
 assert.match(custom,/value\?new Date\(Number\(value\)\)\.toLocaleDateString\("fa-IR"\):""/);
});

test("carton-to-kg conversion is explicit and validates positive inputs",()=>{
 assert.match(custom,/function convertCartonsToKg\(cartons,kgPerCarton\)/);
 assert.match(custom,/تبدیل کارتن به کیلوگرم/);
 assert.match(custom,/confirm\("مقدار /);
});
test("runtime: carton conversion multiplies carton count by product kg factor",()=>{
 const api=loadCustom();
 assert.equal(api.convertCartonsToKg(3,25),75);
 assert.equal(api.convertCartonsToKg(1.5,20),30);
 assert.throws(()=>api.convertCartonsToKg(0,20),/عدد مثبت/);
 assert.throws(()=>api.convertCartonsToKg(2,0),/عدد مثبت/);
});

test("custom report saves print template header footer paper and orientation",()=>{
 assert.match(custom,/crPrintHeader/);
 assert.match(custom,/crPrintFooter/);
 assert.match(custom,/crPrintPaper/);
 assert.match(custom,/crPrintOrientation/);
 assert.match(custom,/@page\{size:/);
});


test("invoice print designer stores reusable templates and exposes safe print settings",()=>{
 assert.ok(custom.includes("PRINT_TEMPLATE_ID"));
 assert.ok(custom.includes("async function addPrintTemplate()"));
 assert.ok(custom.includes("async function savePrintTemplate()"));
 assert.ok(custom.includes('id="ptSelect"'));
 assert.ok(custom.includes("data-pt-row"));
 assert.ok(custom.includes("getInvoicePrintTemplate"));
});
test("saved invoice print template is loaded during PWA module initialization",()=>{
 const init=custom.slice(custom.indexOf("async function init()"));
 assert.ok(init.indexOf("await readPrintTemplates()")<init.indexOf("ready=true"));
});

test("invoice print template API supplies a safe default layout",()=>{
 const api=loadCustom();
 const template=api.getInvoicePrintTemplate();
 assert.equal(template.paper,"A4");
 assert.equal(template.orientation,"portrait");
 assert.ok(Array.isArray(template.sections));
 assert.ok(template.sections.includes("items"));
});
 
test("custom fields IndexedDB connection closes on version change and settles blocked opens once",()=>{
 assert.ok(custom.includes("connection.onversionchange=()=>connection.close()"));
 assert.ok(custom.includes("let settled=false"));
 assert.ok(custom.includes("if(settled){connection.close();return}"));
});

test("backup restore refreshes custom field and report definitions from IndexedDB",()=>{
 assert.match(app,/HolooCustomFields\?\.reloadConfig\?\.\(\)/);
 assert.ok(app.includes('"auditLog"'));
 assert.ok(custom.includes("async function reloadConfig()"));
});

test("invoice and order row restoration explicitly rehydrates custom line controls",()=>{
 assert.ok(app.includes("hydrateRow(row,line.customFields||{})"));
 assert.ok(custom.includes("function hydrateRow(row,values)"));
 assert.ok(custom.includes("delete row.dataset.customFieldsReady"));
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
 assert.match(sw,/holloo-pwa-v156-offline-query-fallback/);
 assert.match(sw,/"\.\/custom-fields\.js"/);
 assert.match(sw,/custom-fields\\\.js/);
});
test("user-defined fields are validated and never evaluated as executable code",()=>{
 assert.match(custom,/allowed=new Set\(\["text","number","date","select","checkbox","textarea"\]\)/);
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

test("custom report builder saves reports, previews data and exports CSV/print",()=>{
 assert.match(custom,/REPORT_CONFIG_ID="__HOLLOO_CUSTOM_REPORTS_V1__"/);
 assert.match(custom,/async function saveCustomReport/);
 assert.match(custom,/async function runCustomReport/);
 assert.match(custom,/خروجی CSV/);
 assert.match(custom,/چاپ گزارش/);
});
test("custom report columns use a fixed whitelist and safe text rendering",()=>{
 assert.match(custom,/const reportSchemas=/);
 assert.match(custom,/td\.textContent=value/);
 assert.match(custom,/function safeCsvCell/);
});
test("report configuration is stored separately in the existing audit store",()=>{
 assert.match(custom,/db\.transaction\(STORE,"readwrite"\)/);
 assert.match(custom,/REPORT_CONFIG_ID/);
});

test("custom reports read custom line values from invoice and order line arrays",()=>{
 assert.match(custom,/report\.dataset==="invoices"\|\|report\.dataset==="salesOrders"/);
 assert.match(custom,/row\.lines\|\|\[\]/);
});

test("custom reports render empty date fields as blank, not the Unix epoch",()=>{
 assert.match(custom,/value\?new Date\(Number\(value\)\)\.toLocaleDateString\("fa-IR"\):""/);
});

test("carton-to-kg conversion is explicit and validates positive inputs",()=>{
 assert.match(custom,/function convertCartonsToKg\(cartons,kgPerCarton\)/);
 assert.match(custom,/تبدیل کارتن به کیلوگرم/);
 assert.match(custom,/confirm\("مقدار /);
});
test("runtime: carton conversion multiplies carton count by product kg factor",()=>{
 const api=loadCustom();
 assert.equal(api.convertCartonsToKg(3,25),75);
 assert.equal(api.convertCartonsToKg(1.5,20),30);
 assert.throws(()=>api.convertCartonsToKg(0,20),/عدد مثبت/);
 assert.throws(()=>api.convertCartonsToKg(2,0),/عدد مثبت/);
});

test("custom report saves print template header footer paper and orientation",()=>{
 assert.match(custom,/crPrintHeader/);
 assert.match(custom,/crPrintFooter/);
 assert.match(custom,/crPrintPaper/);
 assert.match(custom,/crPrintOrientation/);
 assert.match(custom,/@page\{size:/);
});

test("multiline custom fields are available and safely escaped in textarea controls",()=>{ assert.match(custom,/d\.type==="textarea"/); assert.match(custom,/maxlength="500"/); assert.match(custom,/value="textarea">یادداشت چندخطی/); });


test("runtime: custom report CSV neutralizes formulas after leading control whitespace",()=>{
 const api=loadCustom();
 assert.equal(api.safeCsvCell("=1+1"), "\"'=1+1\"");
 assert.equal(api.safeCsvCell("\t=1+1"), "\"'\t=1+1\"");
 assert.equal(api.safeCsvCell("\r=1+1"), "\"'\r=1+1\"");
 assert.equal(api.safeCsvCell("\n=1+1"), "\"'\n=1+1\"");
 assert.equal(api.safeCsvCell("متن عادی"), "\"متن عادی\"");
});
