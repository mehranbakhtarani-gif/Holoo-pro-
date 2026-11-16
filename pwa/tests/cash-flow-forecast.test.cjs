const test=require("node:test");
const assert=require("node:assert/strict");
const {buildCashFlowForecast,getDailyCashFlowProjection,calculateCashOpeningBalances}=require("../cash-flow-forecast.js");
const day=86400000,asOf=Date.UTC(2026,10,16,12);
test("projects weekly opening and closing cash from dated inflows and outflows",()=>{
 const report=buildCashFlowForecast({asOf,horizonDays:30,openingCashRial:1000000,events:[
  {direction:"INFLOW",amountRial:500000,dueDate:asOf+2*day,source:"receivable"},
  {direction:"OUTFLOW",amountRial:300000,dueDate:asOf+9*day,source:"supplier"},
  {direction:"OUTFLOW",amountRial:200000,dueDate:asOf+29*day,source:"cheque"}
 ]});
 assert.equal(report.expectedInflowsRial,500000);assert.equal(report.expectedOutflowsRial,500000);
 assert.equal(report.closingCashRial,1000000);assert.equal(report.weekly.length,5);
 assert.equal(report.weekly[0].closingCashRial,1500000);assert.equal(report.weekly[1].closingCashRial,1200000);
 assert.equal(report.weekly[4].closingCashRial,1000000);
});
test("separates overdue and undated obligations from future cash projection",()=>{
 const report=buildCashFlowForecast({asOf,horizonDays:60,openingCashRial:2000,events:[
  {direction:"INFLOW",amountRial:500,dueDate:asOf-day},
  {direction:"OUTFLOW",amountRial:700,dueDate:asOf-2*day},
  {direction:"INFLOW",amountRial:900,dueDate:null},
  {direction:"OUTFLOW",amountRial:1000,dueDate:null},
  {direction:"OUTFLOW",amountRial:300,dueDate:asOf+70*day}
 ]});
 assert.equal(report.overdueInflowsRial,500);assert.equal(report.overdueOutflowsRial,700);
 assert.equal(report.undatedInflowsRial,900);assert.equal(report.undatedOutflowsRial,1000);
 assert.equal(report.overdueCount,2);assert.equal(report.undatedCount,2);
 assert.equal(report.closingCashRial,2000);assert.equal(report.eventsCount,0);
});
test("does not silently combine invalid currencies or non-Rial event amounts",()=>{
 assert.throws(()=>buildCashFlowForecast({asOf,horizonDays:45,openingCashRial:0,events:[]}),/معتبر/);
 assert.throws(()=>buildCashFlowForecast({asOf,horizonDays:30,openingCashRial:0,events:[{direction:"OUTFLOW",amountRial:1.5,dueDate:asOf}]}),/معتبر/);
 assert.throws(()=>buildCashFlowForecast({asOf,horizonDays:30,openingCashRial:0,events:[{direction:"OTHER",amountRial:10,dueDate:asOf}]}),/معتبر/);
});
test("flags the lowest projected cash point when payments exceed available cash",()=>{
 const report=buildCashFlowForecast({asOf,horizonDays:90,openingCashRial:100,events:[
  {direction:"OUTFLOW",amountRial:300,dueDate:asOf+3*day},
  {direction:"INFLOW",amountRial:500,dueDate:asOf+50*day}
 ]});
 assert.equal(report.minimumProjectedCashRial,-200);assert.equal(report.closingCashRial,300);
});

test("rejects unsafe weekly totals and projected closing balances",()=>{
 assert.throws(()=>buildCashFlowForecast({asOf,horizonDays:30,openingCashRial:0,events:[
  {direction:"INFLOW",amountRial:Number.MAX_SAFE_INTEGER,dueDate:asOf+day},
  {direction:"INFLOW",amountRial:1,dueDate:asOf+2*day}
 ]}),/محدوده/);
 assert.throws(()=>buildCashFlowForecast({asOf,horizonDays:30,openingCashRial:Number.MAX_SAFE_INTEGER,events:[
  {direction:"INFLOW",amountRial:1,dueDate:asOf+day}
 ]}),/محدوده/);
});
test("detects intraday running-balance overflow even if the weekly net is zero",()=>{
 assert.throws(()=>buildCashFlowForecast({asOf,horizonDays:30,openingCashRial:Number.MAX_SAFE_INTEGER,events:[
  {direction:"INFLOW",amountRial:1,dueDate:asOf+day},
  {direction:"OUTFLOW",amountRial:1,dueDate:asOf+2*day}
 ]}),/محدوده/);
});
test("rejects fractional or invalid due-date timestamps",()=>{
 assert.throws(()=>buildCashFlowForecast({asOf,horizonDays:30,openingCashRial:0,events:[
  {direction:"OUTFLOW",amountRial:1,dueDate:asOf+0.5}
 ]}),/تاریخ سررسید/);
});

test("PWA wires the cash flow dashboard and helper into the offline build",()=>{
 const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"..");
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8"),html=fs.readFileSync(path.join(root,"index.html"),"utf8"),sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.match(app,/cashFlow:\["جریان نقدی"/);assert.match(app,/if\(currentPage===\"cashFlow\"\)/);
 assert.match(app,/buildCashFlowForecast\(/);assert.match(app,/1101/);assert.match(app,/1102/);
 assert.match(app,/data-cash-horizon/);assert.match(app,/treasuryAllocations/);
 assert.match(html,/cash-flow-forecast\.js/);assert.ok(html.indexOf("cash-flow-forecast.js")<html.indexOf("app.js"));
 assert.match(sw,/cash-flow-forecast\.js/);assert.match(sw,/import-capital-planner\.js/);assert.match(sw,/holloo-pwa-v\d+-[a-z0-9-]+/);
});

test("detects an intrawweek cash shortfall even when the weekly closing balance recovers",()=>{
 const report=buildCashFlowForecast({asOf,horizonDays:30,openingCashRial:100,events:[
  {direction:"OUTFLOW",amountRial:300,dueDate:asOf+2*day},
  {direction:"INFLOW",amountRial:500,dueDate:asOf+5*day}
 ]});
 assert.equal(report.weekly[0].closingCashRial,300);
 assert.equal(report.minimumProjectedCashRial,-200);
});


test("cash flow dashboard provides print-ready A4 report for selected horizon",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
 assert.match(app,/id="printCashFlowForecast"/);
 assert.match(app,/printCashFlow\.onclick/);
 assert.match(app,/گزارش جریان نقدی و پیش‌بینی نقدینگی/);
 assert.match(app,/@page\{size:A4 landscape/);
 assert.match(app,/const content=\$\("#main"\)\.innerHTML/);
});


test("cash flow dashboard exports summary and all visible forecast tables as CSV",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
 assert.match(app,/id="exportCashFlowCsv"/);
 assert.match(app,/exportCashFlow\.onclick/);
 assert.match(app,/holloo-cash-flow-/);
 assert.match(app,/textContent\.trim\(\)/);
 assert.match(app,/text\/csv;charset=utf-8/);
});


test("cash flow dashboard renders an interactive monthly calendar with daily inflow and outflow totals",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8"),css=fs.readFileSync(path.join(__dirname,"..","style.css"),"utf8");
 assert.match(app,/cashFlowCalendarOffset/);assert.match(app,/data-cash-calendar-nav/);assert.match(app,/data-cash-calendar-day/);assert.match(app,/cash-calendar-in/);assert.match(app,/cash-calendar-out/);assert.match(app,/displayEvents=cashFlowCalendarSelectedDate/);assert.match(css,/\.cash-calendar-grid/);assert.match(css,/\.cash-calendar-day/);
});

 
test("daily projection carries forward balances and flags a shortfall on the exact day",()=>{
 const start=new Date(2026,10,16,12).getTime(),day=86400000;
 const rows=getDailyCashFlowProjection({asOf:start,horizonDays:30,openingCashRial:100,events:[
  {direction:"OUTFLOW",amountRial:180,dueDate:new Date(2026,10,18,9).getTime()},
  {direction:"INFLOW",amountRial:120,dueDate:new Date(2026,10,21,9).getTime()}
 ]});
 assert.equal(rows.length,30);assert.equal(rows[0].closingCashRial,100);assert.equal(rows[2].closingCashRial,-80);assert.equal(rows[2].shortfall,true);assert.equal(rows[3].closingCashRial,-80);assert.equal(rows[5].closingCashRial,40);assert.equal(rows[5].shortfall,false);
});
test("daily projection excludes overdue, undated and events outside the forecast horizon",()=>{
 const start=new Date(2026,10,16,12).getTime(),day=86400000;
 const rows=getDailyCashFlowProjection({asOf:start,horizonDays:30,openingCashRial:500,events:[
  {direction:"OUTFLOW",amountRial:300,dueDate:start-day},
  {direction:"OUTFLOW",amountRial:300,dueDate:null},
  {direction:"OUTFLOW",amountRial:300,dueDate:start+30*day}
 ]});
 assert.ok(rows.every(x=>x.closingCashRial===500&&!x.shortfall));
});
test("calendar renders daily projected balance and shortfall indicators",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8"),css=fs.readFileSync(path.join(__dirname,"..","style.css"),"utf8");
 assert.match(app,/getDailyCashFlowProjection/);assert.match(app,/projection\.shortfall/);assert.match(app,/cash-calendar-balance/);assert.match(app,/cash-calendar-alert/);assert.match(css,/\.cash-calendar-shortfall/);assert.match(css,/\.cash-calendar-alert/);
});

 
test("cash flow dashboard includes a seven-day due summary for near-term inflows and payments",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
 assert.match(app,/sevenDayEnd/);assert.match(app,/nearDueInflows/);assert.match(app,/nearDueOutflows/);assert.match(app,/سررسیدهای ۷ روز آینده/);assert.match(app,/nearDueMarkup/);
});

 
test("cash flow dashboard reports first and worst projected shortfall dates and duration",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
 assert.match(app,/firstShortfallDay/);assert.match(app,/worstShortfallDay/);assert.match(app,/shortfallDays/);assert.match(app,/اولین روز کسری نقد/);assert.match(app,/شدیدترین کسری نقد/);assert.match(app,/روزهای دارای کسری/);
});

test("cash flow opening balance includes every cash and bank subaccount, not only control accounts",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/const cashBalanceGroup=prefix=>accounts\.filter\(x=>x\.type==="ASSET"&&String\(x\.id\)\.startsWith\(prefix\)\)/);
 assert.match(app,/cashBalanceGroup\("1101"\),bankBalanceRial=cashBalanceGroup\("1102"\)/);
 assert.match(app,/voucherLines\.filter\(x=>String\(x\.accountCode\)===code\)/);
});


test("cash forecast opening balance includes every asset cash and bank subaccount exactly once",()=>{
 const accounts=[
  {id:"1101",type:"ASSET",openingDebitRial:1000,openingCreditRial:100},
  {id:"110101",type:"ASSET",openingDebitRial:500,openingCreditRial:0},
  {id:"1102",type:"ASSET",openingDebitRial:2000,openingCreditRial:0},
  {id:"110201",type:"ASSET",openingDebitRial:3000,openingCreditRial:200},
  {id:"1103",type:"ASSET",openingDebitRial:9000,openingCreditRial:0},
  {id:"2101",type:"LIABILITY",openingDebitRial:0,openingCreditRial:700}
 ];
 const voucherLines=[
  {accountCode:"1101",debitRial:50,creditRial:25},
  {accountCode:"110101",debitRial:0,creditRial:100},
  {accountCode:"1102",debitRial:300,creditRial:0},
  {accountCode:"110201",debitRial:0,creditRial:500},
  {accountCode:"1103",debitRial:1000,creditRial:0}
 ];
 const result=calculateCashOpeningBalances({accounts,voucherLines});
 assert.deepEqual(result,{cashOnHandRial:1325,bankBalanceRial:4600,openingCashRial:5925});
});

test("cash forecast opening balance excludes liabilities and unrelated asset accounts",()=>{
 const result=calculateCashOpeningBalances({accounts:[
  {id:"1101",type:"ASSET",openingDebitRial:0,openingCreditRial:0},
  {id:"1102",type:"ASSET",openingDebitRial:0,openingCreditRial:0},
  {id:"110101",type:"LIABILITY",openingDebitRial:900,openingCreditRial:0},
  {id:"110201",type:"EXPENSE",openingDebitRial:800,openingCreditRial:0},
  {id:"1201",type:"ASSET",openingDebitRial:700,openingCreditRial:0}
 ],voucherLines:[]});
 assert.deepEqual(result,{cashOnHandRial:0,bankBalanceRial:0,openingCashRial:0});
});

test("cash forecast opening balance rejects malformed and overflowing subaccount balances",()=>{
 assert.throws(()=>calculateCashOpeningBalances({accounts:[{id:"110101",type:"ASSET",openingDebitRial:1.5}],voucherLines:[]}),/معتبر/);
 assert.throws(()=>calculateCashOpeningBalances({accounts:[
  {id:"110101",type:"ASSET",openingDebitRial:Number.MAX_SAFE_INTEGER},
  {id:"110102",type:"ASSET",openingDebitRial:1}
 ],voucherLines:[]}),/محدوده/);
 assert.throws(()=>calculateCashOpeningBalances({accounts:[{id:"110101",type:"ASSET",openingDebitRial:Number.MAX_SAFE_INTEGER}],voucherLines:[
  {accountCode:"110101",debitRial:1,creditRial:0}
 ]}),/محدوده/);
});

test("cash flow dashboard delegates opening cash calculation to the tested subaccount helper",()=>{
 const fs=require("node:fs"),path=require("node:path"),app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
 assert.match(app,/calculateCashOpeningBalances\(\{accounts,voucherLines\}\)/);
 assert.doesNotMatch(app,/cashBalanceGroup\s*=\s*prefix/);
});
