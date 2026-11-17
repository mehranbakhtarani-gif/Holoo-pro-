const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

function bodyBetween(startMarker,endMarker){
 const start=app.indexOf(startMarker),end=app.indexOf(endMarker,start);
 assert.ok(start>=0&&end>start,"Expected source section not found: "+startMarker);
 return app.slice(start,end);
}

test("treasury reversal exactly negates party balance, party ledger and journal",()=>{
 const body=bodyBetween("async function reverseTreasuryPwa(id){","async function reverseTreasuryAllocationPwa(id){");
 assert.match(body,/applyPartyBalanceDelta\(party,original\.kind==="RECEIPT"\?Number\(original\.amount\):-Number\(original\.amount\)\)/);
 assert.match(body,/debitRial:original\.kind==="RECEIPT"\?Number\(original\.amount\):0,creditRial:original\.kind==="PAYMENT"\?Number\(original\.amount\):0/);
 assert.match(body,/debitRial:Number\(line\.creditRial\|\|0\),creditRial:Number\(line\.debitRial\|\|0\)/);
 assert.match(body,/accountCode:original\.accountCode/);
 assert.match(body,/reversalOfId:original\.id/);
});

test("cheque reversal exactly negates settlement balances and preserves the settled bank account",()=>{
 const body=bodyBetween("async function reverseClearedCheckPwa(id){","async function reverseTreasuryPwa(id){");
 assert.match(body,/applyPartyBalanceDelta\(party,original\.kind==="RECEIPT"\?amount:-amount\)/);
 assert.match(body,/debitRial:original\.kind==="RECEIPT"\?amount:0,creditRial:original\.kind==="PAYMENT"\?amount:0/);
 assert.match(body,/debitRial:Number\(line\.creditRial\|\|0\),creditRial:Number\(line\.debitRial\|\|0\)/);
 assert.match(body,/accountCode:original\.accountCode/);
 assert.match(body,/reversalOfId:original\.id/);
 assert.match(body,/check\.status="BOUNCED";check\.bouncedAfterClearing=true/);
});

test("both reversal flows are atomic, concurrency-guarded and blocked from duplicate reversal",()=>{
 const cheque=bodyBetween("async function reverseClearedCheckPwa(id){","async function reverseTreasuryPwa(id){");
 const treasury=bodyBetween("async function reverseTreasuryPwa(id){","async function reverseTreasuryAllocationPwa(id){");
 for(const body of [cheque,treasury]){
  assert.match(body,/original\.status==="REVERSED"/);
  assert.match(body,/postVoucherAtomic\(/);
  assert.match(body,/reversalOfId:original\.id/);
  assert.match(body,/expected:originalSnapshot|expected:treasurySnapshot/);
  assert.match(body,/expected:partySnapshot/);
 }
 assert.match(app,/if\(voucher\.reference&&check\.result\.some\(v=>v\.reference===voucher\.reference\)\)/);
});
