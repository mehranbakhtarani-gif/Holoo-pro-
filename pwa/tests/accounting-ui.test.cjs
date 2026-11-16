const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("account creation and edit buttons report form-opening failures",()=>{
 assert.match(app,/newAccountButton\.onclick=\(\)=>openForm\("accounts"\)\.catch\(e=>toast\(e\.message\|\|"فرم حساب باز نشد"\)\)/);
 assert.match(app,/await openForm\("accounts",item\)/);
 assert.match(app,/فرم ویرایش حساب باز نشد/);
});
