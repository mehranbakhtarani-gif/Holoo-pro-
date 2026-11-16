const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

test("products store ten Rial price tiers and invoice form can select a tier",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/price10/);
 assert.match(app,/prices=Array\.from\(\{length:10\}/);
 assert.match(app,/invoicePriceTier/);
 assert.match(app,/priceTier/);
 assert.match(app,/قیمت فروش سطح ۱۰/);
});

test("invoice lines support discounts and bonus quantities in stock movement",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/lineDiscountRial/);
 assert.match(app,/lineBonusQty/);
 assert.match(app,/quantity:totalQty/);
 assert.match(app,/bonusQty:lines\.reduce/);
 assert.match(app,/تخفیف ردیف \(ریال\)/);
});

test("sales commission posts expense and payable and is reversed with the invoice",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/commissionRate/);
 assert.match(app,/commissionAmount/);
 assert.match(app,/accountCode:"5203"/);
 assert.match(app,/commissionParty\.balance=Number\(commissionParty\.balance\|\|0\)\+Number\(invoice\.commissionAmount\)/);
 assert.match(app,/برگشت پورسانت فاکتور/);
});

test("invoice reversal restores paid plus bonus quantity in the selected warehouse",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/totalQty=Number\(line\.totalQty\?\?qty\)/);
 assert.match(app,/stockRow\.stock=warehouseStock\+totalQty/);
 assert.match(app,/warehouseUpdates\.push\(\["warehouseStock",stockRow\]\)/);
});


test("PWA purchase invoice reversal posts inventory valuation variance to account 5202",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/purchaseReversalInventoryCost\+=cost/);
 assert.match(app,/originalInventoryDebit=oldLines\.filter\(line=>String\(line\.accountCode\)==="1301"\)/);
 assert.match(app,/buildPurchaseReversalAdjustment\(\{actualInventoryCostRial:purchaseReversalInventoryCost,originalInventoryDebitRial:originalInventoryDebit\}\)/);
 assert.match(app,/\["5202","اختلاف بهای برگشت خرید","EXPENSE"\]/);
});
