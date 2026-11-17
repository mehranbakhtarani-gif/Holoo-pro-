const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

test("party reconciliation module is loaded before app and cached offline",()=>{
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.ok(html.indexOf("party-reconciliation.js")>=0);
 assert.ok(html.indexOf("party-reconciliation.js")<html.indexOf("app.js?v="));
 assert.match(sw,/\.\/party-reconciliation\.js/);
 assert.match(sw,/holloo-pwa-v176-party-subledger-reconciliation/);
});

test("parties page renders read-only reconciliation for balances, subledger and control accounts",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/HolooPartyReconciliation\.reconcilePartyBalances/);
 assert.match(app,/تطبیق مانده اشخاص با دفتر تفصیلی و حساب‌های کنترلی/);
 assert.match(app,/accountBalances\["1103"\]/);
 assert.match(app,/accountBalances\["2101"\]/);
 assert.match(app,/این گزارش فقط خواندنی است/);
});
