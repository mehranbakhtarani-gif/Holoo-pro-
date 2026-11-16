const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("party statement print action opens a printable statement for the selected party",()=>{
 assert.match(app,/data-party-statement=/);
 assert.match(app,/querySelectorAll\("\[data-party-statement\]"\)/);
 assert.match(app,/صورتحساب طرف حساب/);
 assert.match(app,/popup\.print\(\)/);
});

test("party statement CSV exports opening balance and dated running ledger balances",()=>{
 assert.match(app,/data-party-statement-csv=/);
 assert.match(app,/a\.download="party-statement-"\+party\.id\+"\.csv"/);
 assert.match(app,/مانده افتتاحیه/);
 assert.match(app,/partyLedger\.filter\(r=>Number\(r\.partyId\)===Number\(party\.id\)\)/);
 assert.match(app,/ماهیت/);
});
