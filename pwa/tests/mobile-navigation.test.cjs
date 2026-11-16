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
