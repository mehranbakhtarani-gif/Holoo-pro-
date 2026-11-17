const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("cheque page supports search, due-date summaries and lifecycle actions",()=>{
 assert.match(app,/جست‌وجوی شماره، طرف حساب، بانک، مبلغ، تاریخ یا وضعیت/);
 assert.match(app,/سررسید گذشته/);
 assert.match(app,/x\.amount,fmt\(x\.amount\|\|0\),date\(x\.issue\),date\(x\.due\),x\.endorseToPartyName/);
 assert.match(app,/data-check-print/);
 assert.match(app,/data-check-status="BOUNCED"/);
 assert.match(app,/data-check-status="CANCELLED"/);
});

test("cheque endorsement select is populated with eligible payees",()=>{
 assert.match(app,/fields\.checks\.find\(x=>x\[0\]==="endorseToPartyId"\)\[4\]=parties\.filter\(p=>p\.kind!=="CUSTOMER"\)/);
});

test("cheque bounce and cancellation retain explicit event timestamps",()=>{
 assert.match(app,/if\(next==="BOUNCED"\)c\.bouncedAt=c\.statusChangedAt/);
 assert.match(app,/if\(next==="CANCELLED"\)c\.cancelledAt=c\.statusChangedAt/);
});

 
test("cleared cheques can be reversed with ledger and treasury corrections",()=>{
 assert.match(app,/async function reverseClearedCheckPwa/);
 assert.match(app,/data-check-reverse/);
 assert.match(app,/check\.bouncedAfterClearing=true/);
 assert.match(app,/treasuryAllocations",match:\{treasuryId:Number\(original\.id\)\},expected:null/);
});

test("check register exports all lifecycle fields to CSV",()=>{
 assert.match(app,/id="exportChecksCsv"/);
 assert.match(app,/holloo-checks\.csv/);
 assert.match(app,/تاریخ صدور/);
 assert.match(app,/ظهرنویسی به نفع/);
 assert.match(app,/check\.status==="BOUNCED"/);
});

 
test("open-check bounce and cancellation transitions use the same stale-state guard as clearing",()=>{
 const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/c\.status=next;c\.statusChangedAt=Date\.now\(\);if\(next==="BOUNCED"\)c\.bouncedAt=c\.statusChangedAt;if\(next==="CANCELLED"\)c\.cancelledAt=c\.statusChangedAt;await putManyGuarded\(\[\["checks",c\]\],\[\{store:"checks",key:Number\(c\.id\),expected:checkSnapshot\}\]\)/);
});

test("endorsed cheque register exposes a reversal action and distinguishes reversed endorsements",()=>{
 assert.match(app,/data-check-endorsement-reverse/);
 assert.match(app,/ظهرنویسی برگشت‌شده/);
});
