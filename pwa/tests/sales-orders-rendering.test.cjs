const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

test("sales orders page has one authoritative renderer and keeps operation-date controls",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.equal(app.split('if(currentPage==="salesOrders")').length-1,1);
 assert.ok(app.includes("bindOperationDateControls()"));
 assert.ok(app.includes("operation-date-bar"));
});
