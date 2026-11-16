const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
test("backup exports every IndexedDB store with schema and record counts",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/version:2,schemaVersion:DB_VERSION/);
 assert.match(app,/storeNames:\[\.\.\.stores\]/);
 assert.match(app,/db\.transaction\(stores,"readonly"\)/);
 assert.match(app,/tx\.oncomplete=\(\)=>resolve\(snapshot\)/);
});
test("restore validates app version, file size, store names and complete v2 schema",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/file\.size>50\*1024\*1024/);
 assert.match(app,/\[1,2\]\.includes\(Number\(data\.version\)\)/);
 assert.match(app,/unknown=Object\.keys\(data\.records\)\.filter\(name=>!stores\.includes\(name\)\)/);
 assert.match(app,/Number\(data\.schemaVersion\)!==DB_VERSION/);
 assert.match(app,/data\.counts\[store\]!==rows\.length/);
 assert.match(app,/data\.storeNames\.length!==stores\.length/);
});
test("restore rejects invalid and duplicate record IDs before touching IndexedDB",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/!\("id" in row\)/);
 assert.match(app,/ids\.has\(key\)/);
 const validate=app.indexOf("async function restoreBackup");
 const confirm=app.indexOf("if\(!confirm",validate);
 const transaction=app.indexOf('db.transaction(stores,"readwrite")',validate);
 assert.ok(validate>=0&&confirm>validate&&transaction>confirm);
});
test("restore downloads a full pre-restore backup and replaces stores atomically",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/await exportBackup\("holloo-before-restore"\)/);
 assert.match(app,/const tx=db\.transaction\(stores,"readwrite"\)/);
 assert.match(app,/objectStore\.clear\(\);for\(const row of data\.records\[store\]\)objectStore\.put\(row\)/);
 assert.match(app,/tx\.onabort/);
});
test("backup download is size-limited and confirms the pre-restore backup before replacement",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/blob\.size>50\*1024\*1024/);
 const backup=app.indexOf('await exportBackup("holloo-before-restore")');
 const saved=app.indexOf("دانلود نسخه پشتیبان فعلی آغاز شد",backup);
 const transaction=app.indexOf('db.transaction(stores,"readwrite")',backup);
 assert.ok(saved>backup&&transaction>saved);
});
test("backup button catches export failures without passing the click event as a prefix",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/\$\("#exportBtn"\)\.onclick=\(\)=>exportBackup\(\)\.catch/);
});

test("backup download URL is revoked after a delay rather than immediately",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/setTimeout\(\(\)=>URL\.revokeObjectURL\(url\),30000\)/);
});

test("restore rejects v2 backups missing a records store or requiring a newer schema",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/stores\.some\(name=>!data\.storeNames\.includes\(name\)\)/);
 assert.match(app,/Object\.prototype\.hasOwnProperty\.call\(data\.records,store\)/);
 assert.match(app,/Number\(data\.schemaVersion\)!==DB_VERSION/);
 assert.match(app,/data\.counts\[store\]!==rows\.length/);
});

test("backup and restore controls surface errors and allow retrying the same file",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/exportBackup\(\)\.catch\(e=>toast\(e\.message\|\|"تهیه پشتیبان ناموفق بود"\)\)/);
 assert.match(app,/finally\(\(\)=>\{e\.target\.value=""\}\)/);
});
