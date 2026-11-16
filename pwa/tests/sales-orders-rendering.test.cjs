const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

test("sales orders page has one authoritative renderer and keeps operation-date controls",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.equal((app.match(/if\\(currentPage===\"salesOrders\"\\)/g)||[]).length,1);
 assert.match(app,/bindOperationDateControls\\(\\)/);
 assert.match(app,/operation-date-bar/);
});
