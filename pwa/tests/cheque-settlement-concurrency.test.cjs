const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("cheque clearing guards the original check, party balance and duplicate treasury reference",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf('const next=b.dataset.checkStatus');
 const end=app.indexOf("\nconst fields={",start);
 assert.ok(start>=0&&end>start,"cheque status handler must exist");
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
 const start=app.indexOf('const next=b.dataset.checkStatus');
 const end=app.indexOf('\nif(currentPage===',start);
 const body=app.slice(start,end);
 for(const expected of [
  "const targetSnapshot={...target}",
  '{store:"checks",key:c.id,expected:checkSnapshot}',
  '{store:"parties",key:target.id,expected:targetSnapshot}'
 ])assert.ok(body.includes(expected),"Missing cheque endorsement guard: "+expected);
});

test("endorsed cheque reversal guards both parties, check, original voucher and voucher lines",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 const start=app.indexOf("async function reverseEndorsedCheckPwa");
 const end=app.indexOf("async function reverseTreasuryPwa",start);
 const body=app.slice(start,end);
 for(const expected of [
  '{store:"checks",key:Number(check.id),expected:checkSnapshot}',
  '{store:"parties",key:Number(source.id),expected:sourceSnapshot}',
  '{store:"parties",key:Number(target.id),expected:targetSnapshot}',
  '{store:"vouchers",key:Number(voucher.id),expected:voucherSnapshot}',
  'store:"voucherLines",key:Number(line.id),expected:{...line}'
 ])assert.ok(body.includes(expected),"Missing endorsed cheque reversal guard: "+expected);
});
