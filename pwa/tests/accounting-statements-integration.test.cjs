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

test("ledger rows preserve voucher reference so manual vouchers expose reversal action",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/reference:voucher\.reference\|\|""/);
 assert.match(app,/String\(x\.reference\|\|''\)\.startsWith\('MANUAL:'\)/);
});

test("ledger calculates running balances independently for each account through the report helper",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/buildLedgerRunningRows\(\{rows:ledgerRows,accounts,accountCode:code,fromDate:from,toDate:to\}\)/);
 assert.match(app,/مانده ابتدای بازه برای هر حساب جداگانه محاسبه شده است/);
});

test("accounting page uses the same date-scoped trial balance for all report totals and details",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/const statements=buildFinancialStatements\(\{accounts,vouchers,voucherLines,fromDate:0,toDate:Date\.now\(\)\}\);const trial=statements\.trialBalance/);
 assert.doesNotMatch(app,/const trial=accounts\.map\(a=>\{const rows=voucherLines\.filter/);
});


test("filtered ledger uses the tested running-balance report helper",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/buildLedgerRunningRows\(\{rows:ledgerRows,accounts,accountCode:code,fromDate:from,toDate:to\}\)/);
 assert.match(app,/report\.openingBalances\[code\]\|\|0/);
 assert.match(app,/x\.runningBalance/);
 assert.doesNotMatch(app,/const openingByAccount=new Map\(runningByAccount\)/);
});


test("accounting page offers CSV export for the currently filtered account ledger",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/id="exportLedgerCsv"/);
 assert.match(app,/buildLedgerCsv\(\{rows:ledgerRows,accounts,accountCode:code,fromDate:from,toDate:to\}\)/);
 assert.match(app,/holloo-account-ledger\.csv/);
});
