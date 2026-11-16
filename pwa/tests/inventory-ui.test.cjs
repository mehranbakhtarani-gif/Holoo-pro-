const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("inventory search covers product identifiers, yarn attributes and denier",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/x\.sku,x\.barcode,x\.name,x\.group,x\.group1,x\.group2,x\.group3,x\.unit,x\.yarn,x\.color,x\.denier/);
 assert.match(app,/toLocaleLowerCase\("fa"\)/);
 assert.match(app,/جست‌وجوی کد، بارکد، نام، گروه، نوع نخ، دنیر یا رنگ/);
});

test("inventory price labels follow the selected display unit and show average cost",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.ok(app.includes('بهای میانگین هر کیلو ("+moneyUnit()+")'));
 assert.ok(app.includes('قیمت سطح ۱ ("+moneyUnit()+")'));
 assert.match(app,/money\(x\.avg\|\|0\)/);
});


test("live search rerender preserves keyboard focus and caret position",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const start=s\.selectionStart,end=s\.selectionEnd;render\(\)\.then\(\(\)=>\{const next=\$\("#search"\);if\(next\)\{next\.focus\(\);if\(start!==null&&end!==null\)next\.setSelectionRange\(start,end\)\}\}\)/);
});


test("edit and delete action failures are shown without unhandled rejections",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/function edit\(s,id\).*\.catch\(e=>toast\(e\.message\|\|"فرم ویرایش باز نشد"\)\)/);
 assert.match(app,/\[data-del\].*removeRow\(\.\.\.b\.dataset\.del\.split\(":"\)\)\.catch\(e=>toast\(e\.message\|\|"حذف ناموفق بود"\)\)/);
});


test("products referenced by pending shipments, sales orders, lots or transfers cannot be deleted",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/all\("importShipments"\).*all\("salesOrders"\).*all\("inventoryLots"\).*all\("warehouseTransfers"\)/);
 assert.match(app,/hasShipment\|\|hasOrder\|\|hasLot\|\|hasTransfer\|\|hasWarehouseStock/);
});

 
test("inventory list can filter low, sufficient and unconfigured minimum stock while retaining text search",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/id="inventoryStockFilter"/);
 assert.match(app,/inventoryStockFilter==="LOW"&&Number\(x\.minStock\|\|0\)>0&&Number\(x\.stock\|\|0\)<=Number\(x\.minStock\)/);
 assert.match(app,/inventoryStockFilter==="OK"&&Number\(x\.minStock\|\|0\)>0&&Number\(x\.stock\|\|0\)>Number\(x\.minStock\)/);
 assert.match(app,/inventoryStockFilter==="UNSET"&&Number\(x\.minStock\|\|0\)<=0/);
 assert.match(app,/stockFilter\.onchange=e=>\{inventoryStockFilter=e\.target\.value;render\(\)\}/);
});

test("product creation rejects non-finite and non-positive denier values",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/!Number\.isFinite\(v\.denier\)\|\|v\.denier<=0/);
});

test("inventory supports unique barcodes and minimum-stock alerts",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.ok(app.includes('["barcode","بارکد اصلی","text"]'));
 assert.match(app,/جست‌وجوی کد، بارکد، نام/);
 assert.ok(app.includes('["minStock","حداقل موجودی هشدار (کیلوگرم)","number"]'));
 assert.match(app,/rows\.some\(row=>row\.barcode===record\.barcode/);
 assert.match(app,/Number\(x\.stock\|\|0\)<=Number\(x\.minStock\)/);
 assert.match(app,/حداقل تعیین نشده/);
});

 
test("master-data edits preserve live stock valuation and party balance inside the same IndexedDB transaction",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/function putPreservingFields\(store,record,fields\)/);
 assert.match(app,/const tx=db\.transaction\(\[store,"auditLog"\],"readwrite"\),objectStore=tx\.objectStore\(store\)/);
 assert.match(app,/const read=objectStore\.get\(record\.id\)/);
 assert.match(app,/for\(const field of fields\)merged\[field\]=read\.result\[field\]/);
 assert.match(app,/await putProductUnique\(v\)/);
 assert.match(app,/await putPartyGuarded\(partyRecord\)/);
});
 
test("product, party and warehouse deletion rechecks references atomically before deleting",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/function deleteMasterRecordGuarded\(store,id\)/);
 assert.match(app,/db\.transaction\(\[\.\.\.new Set\(\[\.\.\.stores,"auditLog"\]\)\],"readwrite"\)/);
 assert.match(app,/if\(\["products","parties","warehouses"\]\.includes\(s\)\)\{await deleteMasterRecordGuarded\(s,id\)/);
 assert.match(app,/data\.invoices\.some\(x=>Number\(x\.commissionPartyId\)===key\)/);
});
 
test("party edits preserve opening balance and cannot reclassify parties with history",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const balance=item\?Number\(item\.balance\|\|0\):num\("balance"\)/);
 assert.match(app,/balanceField\.readOnly=true/);
 assert.match(app,/hasHistory&&kind!==item\.kind/);
});

test("party deletion checks orders, import shipments and foreign payable links",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/all\("salesOrders"\).*all\("importShipments"\).*all\("foreignPayables"\).*all\("foreignPayablePayments"\)/);
});

 
test("party statements display opening balance before dated movements",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const opening=Number\(party\.balance\|\|0\)-movement/);
 assert.match(app,/مانده افتتاحیه/);
 assert.match(app,/money\(Math\.abs\(balance\)\)/);
});

 
test("parties page filters by ID, name, type, phone, address and balance",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/جست‌وجوی کد، نام، تلفن، نشانی، نوع یا مانده طرف حساب/);
 assert.match(app,/parties\.filter\(x=>\[x\.id,x\.name,x\.kind==="CUSTOMER"\?"مشتری":x\.kind==="SUPPLIER"\?"تأمین‌کننده":"هر دو",x\.phone,x\.address,x\.balance,fmt\(x\.balance\|\|0\)\]/);
});

 
test("party type changes are blocked while linked import shipments exist",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/all\("importShipments"\).*shipments\.some\(x=>Number\(x\.supplierId\)===Number\(item\.id\)\)/);
});

 
test("dashboard sales and gross profit exclude drafts and reversed invoices while retaining legacy posted rows",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const postedSales=invoices\.filter\(x=>x\.kind==="SALE"&&\(!x\.status\|\|x\.status==="POSTED"\)\)/);
 assert.match(app,/totalSales=postedSales\.reduce/);
 assert.match(app,/cogs=postedSales\.reduce/);
});
 
test("dashboard demo data action is bound and refuses to overwrite a non-empty ledger",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const demoButton=\$\("#loadDemoData"\);if\(demoButton\)demoButton\.onclick/);
 assert.match(app,/vouchersNow\.length\|\|ledgerNow\.length\|\|treasuryNow\.length/);
 assert.match(app,/داده آزمایشی فقط در دفتر کاملاً خالی قابل بارگذاری است/);
});

 
test("demo seeding uses transactional empty-ledger guards to prevent multi-tab duplicate or overwrite races",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const emptyStores=\["products","parties","vouchers","partyLedger","treasury","invoices","checks","imports","importShipments","stockAdjustments"\]/);
 assert.match(app,/emptyStores\.map\(store=>\(\{store,match:\{\},expected:null\}\)\)/);
 assert.match(app,/await putManyGuarded\(entries,guards\)/);
});

 
test("product SKU and barcode uniqueness are enforced in the same transaction as create or edit",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/function putProductUnique\(record\)/);
 assert.match(app,/db\.transaction\(\["products","auditLog"\],"readwrite"\)/);
 assert.match(app,/rows\.some\(row=>row\.sku===record\.sku/);
 assert.match(app,/rows\.some\(row=>row\.barcode===record\.barcode/);
 assert.match(app,/if\(current\)\{for\(const field of \["stock","value","avg"\]\)value\[field\]=current\[field\]\}/);
 assert.match(app,/await putProductUnique\(v\)/);
});

 
test("party type reclassification and balance preservation are rechecked atomically with all financial history stores",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/function putPartyGuarded\(record\)/);
 assert.match(app,/db\.transaction\(\["parties",\.\.\.relatedStores,"auditLog"\],"readwrite"\)/);
 assert.match(app,/relatedStores=\["invoices","treasury","checks","partyLedger","imports","salesOrders","importShipments","foreignPayables","foreignPayablePayments","fixedAssets"\]/);
 assert.match(app,/if\(current\.kind!==record\.kind\)/);
 assert.match(app,/const merged=\{\.\.\.record,balance:current\.balance\}/);
});
