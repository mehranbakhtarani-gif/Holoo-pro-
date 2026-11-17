const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("invoice posting revalidates complete party, product, warehouse, lot and order snapshots atomically",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf('if(page==="invoices"){',app.indexOf("async function saveForm"));
 const end=app.indexOf("\nif(page==="+"\"allocations\""+")",start);
 assert.ok(start>=0&&end>start,"invoice save branch must exist");
 const body=app.slice(start,end);
 for(const expected of [
  "const partySnapshot={...p}",
  "productSnapshots=new Map(pr.map(row=>[Number(row.id),{...row}]))",
  "commissionPartySnapshot=commissionParty?{...commissionParty}:null",
  "warehouseSnapshots=new Map(warehouseRows.map(row=>[Number(row.productId)+\":\"+Number(row.warehouseId),{...row}]))",
  "lotSnapshots=new Map(inventoryLots.map(row=>[String(row.id),{...row}]))",
  "const linkedOrderSnapshot=linkedOrder?{...linkedOrder}:null",
  'const guards=[{store:"parties",key:Number(p.id),expected:partySnapshot},{store:"invoices",match:{number},expected:null}]',
  'guards.push({store:"products",key:id,expected:snapshot})',
  'guards.push({store:"warehouseStock",match:{productId,warehouseId},expected:snapshot||null})',
  'guards.push({store:"inventoryLots",key:snapshot?snapshot.id:row.id,expected:snapshot||null})',
  'guards.push({store:"salesOrders",key:Number(linkedOrder.id),expected:linkedOrderSnapshot})',
  "},journal,guards)"
 ])assert.ok(body.includes(expected),"Missing invoice posting guard: "+expected);
});

 
test("invoice posting rejects unsafe party and commission balance arithmetic before ledger commit",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const nextCommissionBalance=Number\(commissionParty\.balance\|\|0\)-commissionAmount;if\(!Number\.isSafeInteger\(nextCommissionBalance\)\)/);
 assert.match(app,/const nextPartyBalance=Number\(p\.balance\|\|0\)\+\(kind==="SALE"\?total:-total\);if\(!Number\.isSafeInteger\(nextPartyBalance\)\)/);
 assert.match(app,/if\(!Number\.isSafeInteger\(commissionAmount\)\|\|commissionAmount<0\)/);
});

 
test("invoice posting validates cumulative COGS and foreign minor-unit totals",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/cogs\+=lineCogs;if\(!Number\.isSafeInteger\(cogs\)\)/);
 assert.match(app,/foreignSubtotalMinor\+=lineForeignMinor;if\(!Number\.isSafeInteger\(foreignSubtotalMinor\)\)/);
});


test("invoice posting rejects FIFO COGS that exceeds aggregate product inventory value",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/if\(lineCogs>currentValue\)throw Error\("بهای خروج FIFO از ارزش کل موجودی کالا بیشتر است/);
 assert.match(app,/product\.value=currentValue-lineCogs/);
 assert.doesNotMatch(app,/product\.value=Math\.max\(0,currentValue-lineCogs\)/);
});
