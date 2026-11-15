const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

test("accounting page exposes detailed income statement and balance sheet",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/buildFinancialStatements\(/);
 assert.match(app,/صورت سود و زیان تفصیلی/);
 assert.match(app,/ترازنامه تفصیلی/);
 assert.match(app,/statements\.balanceSheet\.difference|statements\.balanceSheet\.equity/);
});

test("period closing is posted as a unique balanced voucher to retained earnings",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/buildPeriodClosingJournal\(/);
 assert.match(app,/YEAR_END_CLOSE:/);
 assert.match(app,/بازه انتخابی با دوره مالی بسته‌شده هم‌پوشانی دارد/);
 assert.match(app,/3201/);
 assert.match(app,/yearEndCloseForm/);
 assert.match(app,/postVoucherAtomic\(\[\]/);
});

test("financial statement module loads before app and is cached by service worker",()=>{
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.ok(html.indexOf("accounting-reports.js")>=0);
 assert.ok(html.indexOf("accounting-reports.js")<html.indexOf("app.js"));
 assert.match(sw,/\.\/accounting-reports\.js/);
});
