const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");

test("invoice entry supports a distinct official or unofficial print format without changing accounting kind",()=>{
 assert.match(app,/name="printFormat"/);
 assert.match(app,/value="OFFICIAL">رسمی/);
 assert.match(app,/value="UNOFFICIAL">غیررسمی/);
 assert.match(app,/printFormat:d\.printFormat==="OFFICIAL"\?"OFFICIAL":"UNOFFICIAL"/);
 assert.match(app,/این گزینه فقط قالب چاپ را مشخص می‌کند/);
});

test("invoice print format is visible in list, print document, search and CSV export",()=>{
 assert.match(app,/x\.printFormat==="OFFICIAL"\?"رسمی":"غیررسمی"/);
 assert.match(app,/قالب '\+\(invoice\.printFormat==="OFFICIAL"\?"رسمی":"غیررسمی"\)/);
 assert.match(app,/invoice\.printFormat==="OFFICIAL"\?"رسمی":"غیررسمی",invoice\.partyName/);
 assert.match(app,/x\.printFormat==="OFFICIAL"\?"رسمی":"غیررسمی",date\(x\.date\)/);
});

test("invoice print-format update refreshes the PWA script and offline cache",()=>{
 assert.match(html,/app\.js\?v=treasury-subaccounts-1/);
 assert.match(sw,/holloo-pwa-v161-treasury-subaccounts/);
});
