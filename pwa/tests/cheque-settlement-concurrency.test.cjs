const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("cheque clearing guards the original check, party balance and duplicate treasury reference",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const handler=app.indexOf('document.querySelectorAll("[data-check-status]")');
 const start=app.indexOf("const next=b.dataset.checkStatus",handler);
 const end=app.indexOf("const fields={",start);
 assert.ok(handler>=0&&start>handler&&end>start,"cheque status handler must exist");
 const body=app.slice(start,end);
 for(const expected of [
  "const checkSnapshot={...c}",
  "const partySnapshot={...party}",
  '{store:"checks",key:c.id,expected:checkSnapshot}',
  '{store:"parties",key:party.id,expected:partySnapshot}',
  '{store:"treasury",match:{reference},expected:null}'
 ])assert.ok(body.includes(expected),"Missing cheque clearing guard: "+expected);
});

test("cheque endorsement guards the check and both party balances",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const handler=app.indexOf('document.querySelectorAll("[data-check-status]")');
 const start=app.indexOf('}else if(next==="ENDORSED"){',handler);
 const end=app.indexOf("c.status=next",start);
 assert.ok(handler>=0&&start>handler&&end>start,"cheque endorsement handler must exist");
 const body=app.slice(start,end);
 for(const expected of [
  "const targetSnapshot={...target}",
  '{store:"checks",key:c.id,expected:checkSnapshot}',
  '{store:"parties",key:target.id,expected:targetSnapshot}'
 ])assert.ok(body.includes(expected),"Missing cheque endorsement guard: "+expected);
});
