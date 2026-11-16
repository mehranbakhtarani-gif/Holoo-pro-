const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("cheque clearing revalidates cheque and party and rejects duplicate treasury reference",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf('const next=b.dataset.checkStatus');
 const end=app.indexOf('\nif(next==="ENDORSED")',start);
 assert.ok(start>=0&&end>start,"cheque status handler must exist");
 const body=app.slice(start,end);
 assert.ok(body.includes("const checkSnapshot={...c}"));
 assert.ok(body.includes("const partySnapshot={...party}"));
 assert.ok(body.includes('store:"checks",key:c.id,expected:checkSnapshot'));
 assert.ok(body.includes('store:"parties",key:party.id,expected:partySnapshot'));
 assert.ok(body.includes('store:"treasury",match:{reference},expected:null'));
});

test("cheque endorsement revalidates cheque and both party balances atomically",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf('if(next==="ENDORSED")');
 const end=app.indexOf('\n}else{\n   c.status=next',start);
 assert.ok(start>=0&&end>start,"cheque endorsement branch must exist");
 const body=app.slice(start,end);
 for(const expected of [
  "const checkSnapshot={...c}",
  "const partySnapshot={...party}",
  "const targetSnapshot={...target}",
  'store:"checks",key:c.id,expected:checkSnapshot',
  'store:"parties",key:party.id,expected:partySnapshot',
  'store:"parties",key:target.id,expected:targetSnapshot'
 ])assert.ok(body.includes(expected),"Missing cheque endorsement guard: "+expected);
});
