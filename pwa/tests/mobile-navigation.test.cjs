const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("mobile navigation renders a defined icon and label for every tab",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/warehouseTransfers:"⇄"/,"warehouse transfer tab must have an icon");
 assert.match(app,/const icon=icons\[k\]\|\|"•"/,"unknown tab icons must use a visible fallback instead of undefined");
 assert.match(app,/Array\.isArray\(titles\[k\]\)&&titles\[k\]\[0\]/,"tab labels must be checked before rendering");
});


test("dashboard quick links are bound after the page content is rendered",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/\$\("#main"\)\.querySelectorAll\("\[data-page\]"\)\.forEach\(b=>b\.onclick=\(\)=>go\(b\.dataset\.page\)\)/,"quick navigation buttons inside rendered pages must navigate");
});


test("dashboard import shortcut and count use the complete shipment workflow",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/\[\x27importShipments\x27,\x27سفارش واردات\x27\]/);
 assert.match(app,/all\("importShipments"\)\]\);/);
 assert.match(app,/محموله‌های وارداتی",fmt\(importShipmentRows\.length\)/);
});
