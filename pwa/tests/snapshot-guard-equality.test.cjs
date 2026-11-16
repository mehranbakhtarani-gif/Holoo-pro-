const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

test("snapshot equality handles arrays and nested objects cloned by IndexedDB",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("function sameGuardValue(");
 const end=app.indexOf("\nfunction postVoucherAtomic",start);
 assert.ok(start>=0&&end>start,"deep snapshot comparator must exist before atomic posting");
 const same=vm.runInNewContext(app.slice(start,end)+"\nsameGuardValue");
 assert.equal(same({lines:[{productId:4,qty:2}],prices:[10,20]},{lines:[{productId:4,qty:2}],prices:[10,20]}),true);
 assert.equal(same({lines:[{productId:4,qty:2}]},{lines:[{productId:4,qty:3}]}),false);
 assert.equal(same({values:[1,2]},{values:[1,2,3]}),false);
 assert.equal(same({value:1},{value:"1"}),false);
 assert.equal(same(null,{}),false);
});

test("atomic guard validation uses deep equality rather than object identity",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("function postVoucherAtomic");
 const end=app.indexOf("\nfunction all(s)",start);
 assert.ok(start>=0&&end>start);
 assert.ok(app.slice(start,end).includes("sameGuardValue(current[key],value)"));
});
