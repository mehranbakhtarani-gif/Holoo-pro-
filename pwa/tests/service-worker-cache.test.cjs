const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("service worker cache version changes when offline cache behavior changes",()=>{
 const sw=fs.readFileSync(path.resolve(__dirname,"../sw.js"),"utf8");
 assert.match(sw,/holloo-pwa-v177-cheque-lifecycle-reconciliation/);
});

test("offline cache fallback ignores asset query versions so pre-cached files remain available",()=>{
 const sw=fs.readFileSync(path.resolve(__dirname,"../sw.js"),"utf8");
 assert.match(sw,/cache\.match\(event\.request,\{ignoreSearch:true\}\)/);
 assert.match(sw,/party-reconciliation\\.js/);
 assert.match(sw,/check-reconciliation\\.js/);
 assert.match(sw,/const cached=await cache\.match\(event\.request,\{ignoreSearch:true\}\)/);
});

test("cheque reconciliation module is loaded before the app and included in offline assets",()=>{
 const html=fs.readFileSync(path.resolve(__dirname,"../index.html"),"utf8");
 const sw=fs.readFileSync(path.resolve(__dirname,"../sw.js"),"utf8");
 assert.ok(html.indexOf("check-reconciliation.js")>=0);
 assert.ok(html.indexOf("check-reconciliation.js")<html.indexOf("app.js?v="));
 assert.match(sw,/\.\/check-reconciliation\.js/);
});
