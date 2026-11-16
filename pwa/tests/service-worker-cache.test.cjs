const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("service worker cache version changes when offline cache behavior changes",()=>{
 const sw=fs.readFileSync(path.resolve(__dirname,"../sw.js"),"utf8");
 assert.match(sw,/holloo-pwa-v164-tabs-16-18/);
});

test("offline cache fallback ignores asset query versions so pre-cached files remain available",()=>{
 const sw=fs.readFileSync(path.resolve(__dirname,"../sw.js"),"utf8");
 assert.match(sw,/cache\.match\(event\.request,\{ignoreSearch:true\}\)/);
 assert.match(sw,/const cached=await cache\.match\(event\.request,\{ignoreSearch:true\}\)/);
});
