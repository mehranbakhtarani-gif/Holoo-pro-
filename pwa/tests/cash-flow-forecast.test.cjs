const test=require("node:test");
const assert=require("node:assert/strict");
const {buildCashFlowForecast}=require("../cash-flow-forecast.js");
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

test("PWA wires the cash flow dashboard and helper into the offline build",()=>{
 const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"..");
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8"),html=fs.readFileSync(path.join(root,"index.html"),"utf8"),sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.match(app,/cashFlow:\["جریان نقدی"/);assert.match(app,/if\(currentPage===\"cashFlow\"\)/);
 assert.match(app,/buildCashFlowForecast\(/);assert.match(app,/1101/);assert.match(app,/1102/);
 assert.match(app,/data-cash-horizon/);assert.match(app,/treasuryAllocations/);
 assert.match(html,/cash-flow-forecast\.js/);assert.ok(html.indexOf("cash-flow-forecast.js")<html.indexOf("app.js"));
 assert.match(sw,/cash-flow-forecast\.js/);assert.match(sw,/holloo-pwa-v53-cash-flow-forecast/);
});

test("detects an intrawweek cash shortfall even when the weekly closing balance recovers",()=>{
 const report=buildCashFlowForecast({asOf,horizonDays:30,openingCashRial:100,events:[
  {direction:"OUTFLOW",amountRial:300,dueDate:asOf+2*day},
  {direction:"INFLOW",amountRial:500,dueDate:asOf+5*day}
 ]});
 assert.equal(report.weekly[0].closingCashRial,300);
 assert.equal(report.minimumProjectedCashRial,-200);
});
