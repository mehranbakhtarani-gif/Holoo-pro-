const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");

test("product master data supports three-level groups, base units and maximum stock",()=>{
 assert.match(app,/\["group1","گروه اصلی","text"\]/);
 assert.match(app,/\["group2","زیرگروه","text"\]/);
 assert.match(app,/\["group3","گروه فرعی","text"\]/);
 assert.match(app,/\["unit","واحد پایه (در این نسخه)","select",1/);
 assert.match(app,/\["maxStock","حداکثر موجودی هدف \(کیلوگرم\)","number"\]/);
 assert.match(app,/group1:String\(d\.group1\|\|""\)\.trim\(\)/);
 assert.match(app,/d\.unit&&d\.unit!=="کیلوگرم"/);
 assert.match(app,/maxStock/);
});

test("product stock thresholds reject invalid or inverted ranges without changing legacy minimum-stock records",()=>{
 assert.match(app,/maxStock>0&&minStock>maxStock/);
 assert.match(app,/حداقل و حداکثر موجودی معتبر نیست/);
});

test("party master data includes classification, contact, tax, credit and banking fields",()=>{
 for(const field of ["group","region","email","nationalId","economicCode","postalCode","creditLimit","creditDays","bankName","bankAccount","iban","notes"]){
  assert.ok(app.includes('["'+field+'"'),"missing party field "+field);
  assert.ok(app.includes(field+':String(d.'+field+'||"").trim()')||field==="creditLimit"||field==="creditDays","missing party persistence "+field);
 }
 assert.match(app,/Number\.isSafeInteger\(creditLimit\).*Number\.isSafeInteger\(creditDays\)/);
});

test("party search includes the expanded identifying and contact fields",()=>{
 assert.match(app,/x\.group,x\.region,x\.phone,x\.email,x\.nationalId,x\.economicCode,x\.postalCode/);
});

test("PWA cache is invalidated for the expanded master-data UI",()=>{
 assert.match(html,/app\.js\?v=master-data-1/);
 assert.match(sw,/holloo-pwa-v157-master-data/);
});
