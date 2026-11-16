const test=require("node:test");
const assert=require("node:assert/strict");
const {buildFinancialStatements,buildPeriodClosingJournal,buildPurchaseReversalAdjustment,hasOverlappingPeriodClose}=require("../accounting-reports.js");

const accounts=[
 {id:"1101",title:"Cash",type:"ASSET",openingDebitRial:80000,openingCreditRial:0},
 {id:"1301",title:"Inventory",type:"ASSET",openingDebitRial:0,openingCreditRial:0},
 {id:"2101",title:"Payables",type:"LIABILITY",openingDebitRial:0,openingCreditRial:0},
 {id:"3101",title:"Capital",type:"EQUITY",openingDebitRial:0,openingCreditRial:80000},
 {id:"3201",title:"Retained earnings",type:"EQUITY",openingDebitRial:0,openingCreditRial:0},
 {id:"4101",title:"Sales",type:"REVENUE",openingDebitRial:0,openingCreditRial:0},
 {id:"5101",title:"Expense",type:"EXPENSE",openingDebitRial:0,openingCreditRial:0}
];
const vouchers=[{id:1,date:100,reference:"SALE"},{id:2,date:200,reference:"EXP"},{id:3,date:300,reference:"ASSET"}];
const voucherLines=[
 {voucherId:1,accountCode:"1101",debitRial:100000,creditRial:0},{voucherId:1,accountCode:"4101",debitRial:0,creditRial:100000},
 {voucherId:2,accountCode:"5101",debitRial:40000,creditRial:0},{voucherId:2,accountCode:"1101",debitRial:0,creditRial:40000},
 {voucherId:3,accountCode:"1301",debitRial:20000,creditRial:0},{voucherId:3,accountCode:"1101",debitRial:0,creditRial:20000}
];

test("builds a balanced balance sheet and period income statement",()=>{
 const report=buildFinancialStatements({accounts,vouchers,voucherLines,fromDate:0,toDate:300});
 assert.equal(report.incomeStatement.revenue,100000);
 assert.equal(report.incomeStatement.expense,40000);
 assert.equal(report.incomeStatement.netProfit,60000);
 assert.equal(report.balanceSheet.assets,140000);
 assert.equal(report.balanceSheet.liabilities,0);
 assert.equal(report.balanceSheet.equity,140000);
 assert.equal(report.balanceSheet.difference,0);
});

test("period reports exclude other dates and existing closing vouchers",()=>{
 const report=buildFinancialStatements({accounts,vouchers:[...vouchers,{id:4,date:250,reference:"YEAR_END_CLOSE:old"}],voucherLines:[...voucherLines,{voucherId:4,accountCode:"4101",debitRial:100000,creditRial:0},{voucherId:4,accountCode:"3201",debitRial:0,creditRial:100000}],fromDate:0,toDate:300});
 assert.equal(report.incomeStatement.revenue,100000);
});

test("creates a balanced closing journal transferring profit to retained earnings",()=>{
 const result=buildPeriodClosingJournal({accounts,vouchers,voucherLines,fromDate:0,toDate:300});
 assert.equal(result.revenue,100000);
 assert.equal(result.expense,40000);
 assert.equal(result.netProfit,60000);
 assert.equal(result.debit,result.credit);
 assert.deepEqual(result.lines.find(x=>x.accountCode==="3201"),{accountCode:"3201",debitRial:0,creditRial:60000,description:"انتقال سود دوره به سود و زیان انباشته"});
});

test("closing journal rejects invalid period or missing retained earnings account",()=>{
 assert.throws(()=>buildPeriodClosingJournal({accounts,vouchers,voucherLines,fromDate:300,toDate:0}));
 assert.throws(()=>buildPeriodClosingJournal({accounts:accounts.filter(x=>x.id!=="3201"),vouchers,voucherLines,fromDate:0,toDate:300}));
});

test("period close overlap detection rejects inclusive intersections and allows separate periods",()=>{
 const closed=[{reference:"YEAR_END_CLOSE:100:199"},{reference:"YEAR_END_CLOSE:300:399"},{reference:"YEAR_END_CLOSE:bad:range"}];
 assert.equal(hasOverlappingPeriodClose(closed,150,250),true);
 assert.equal(hasOverlappingPeriodClose(closed,200,299),false);
 assert.equal(hasOverlappingPeriodClose(closed,250,300),true);
 assert.equal(hasOverlappingPeriodClose(closed,400,500),false);
 assert.throws(()=>hasOverlappingPeriodClose(closed,500,400));
});


test("purchase reversal valuation adjustment balances the difference between current inventory cost and original invoice cost",()=>{
 const higher=buildPurchaseReversalAdjustment({actualInventoryCostRial:12500,originalInventoryDebitRial:10000});
 assert.deepEqual(higher.map(x=>[x.accountCode,x.debitRial,x.creditRial]),[["1301",0,2500],["5202",2500,0]]);
 const lower=buildPurchaseReversalAdjustment({actualInventoryCostRial:7500,originalInventoryDebitRial:10000});
 assert.deepEqual(lower.map(x=>[x.accountCode,x.debitRial,x.creditRial]),[["1301",2500,0],["5202",0,2500]]);
 assert.deepEqual(buildPurchaseReversalAdjustment({actualInventoryCostRial:10000,originalInventoryDebitRial:10000}),[]);
 for(const input of [{actualInventoryCostRial:-1,originalInventoryDebitRial:0},{actualInventoryCostRial:1.5,originalInventoryDebitRial:0},{actualInventoryCostRial:Number.MAX_SAFE_INTEGER,originalInventoryDebitRial:-1}])assert.throws(()=>buildPurchaseReversalAdjustment(input));
});
