const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("service worker cache version and party statement asset are updated",()=>{
 const sw=fs.readFileSync(path.resolve(__dirname,"../sw.js"),"utf8");
 assert.ok(sw.includes('const CACHE="holloo-pwa-v168-import-decimal-cost";'));
 assert.ok(sw.includes('"./party-statement.js"'));
 assert.ok(sw.includes("party-opening-balance\\.js|party-statement\\.js|settlement"));
});

test("offline cache fallback ignores asset query versions so pre-cached files remain available",()=>{
 const sw=fs.readFileSync(path.resolve(__dirname,"../sw.js"),"utf8");
 assert.match(sw,/cache\.match\(event\.request,\{ignoreSearch:true\}\)/);
 assert.match(sw,/const cached=await cache\.match\(event\.request,\{ignoreSearch:true\}\)/);
});
