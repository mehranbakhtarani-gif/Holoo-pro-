const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("cheque clearing revalidates cheque and party and rejects duplicate treasury reference",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf('const next=b.dataset.checkStatus');
 const end=app.indexOf('}else if(next==="ENDORSED"){',start);
 assert.ok(start>=0&&end>start,"cheque clearing branch must exist");
 const body=app.slice(start,end);
 for(const expected of [
  "const checkSnapshot={...c}",
  "const partySnapshot={...party}",
  'store:"checks",key:c.id,expected:checkSnapshot',
  'store:"parties",key:party.id,expected:partySnapshot',
  'store:"treasury",match:{reference},expected:null'
 ])assert.ok(body.includes(expected),"Missing cheque clearing guard: "+expected);
});

test("cheque endorsement revalidates cheque and both party balances atomically",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf('}else if(next==="ENDORSED"){');
 const end=app.indexOf('}else{\n   c.status=next',start);
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
