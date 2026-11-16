function buildFinancialStatements(input){
 const accounts=input.accounts||[],vouchers=input.vouchers||[],voucherLines=input.voucherLines||[];
 const fromDate=Number.isFinite(Number(input.fromDate))?Number(input.fromDate):0;
 const toDate=Number.isFinite(Number(input.toDate))?Number(input.toDate):Number.MAX_SAFE_INTEGER;
 if(fromDate>toDate)throw new Error("بازه گزارش مالی نامعتبر است");
 const voucherById=new Map(vouchers.map(v=>[Number(v.id),v]));
 const allActivity=new Map(),periodActivity=new Map();
 for(const line of voucherLines){
  const voucher=voucherById.get(Number(line.voucherId));if(!voucher)continue;
  const date=Number(voucher.date||0);if(date>toDate)continue;
  const code=String(line.accountCode),debit=Number(line.debitRial||0),credit=Number(line.creditRial||0);
  if(!Number.isSafeInteger(debit)||debit<0||!Number.isSafeInteger(credit)||credit<0)throw new Error("گردش حساب نامعتبر است");
  const current=allActivity.get(code)||{debit:0,credit:0};
  current.debit+=debit;current.credit+=credit;
  if(!Number.isSafeInteger(current.debit)||!Number.isSafeInteger(current.credit))throw new Error("جمع گردش حساب از محدوده مجاز خارج است");
  allActivity.set(code,current);
  if(date>=fromDate&&!String(voucher.reference||"").startsWith("YEAR_END_CLOSE:")){
   const period=periodActivity.get(code)||{debit:0,credit:0};
   period.debit+=debit;period.credit+=credit;
   if(!Number.isSafeInteger(period.debit)||!Number.isSafeInteger(period.credit))throw new Error("جمع گردش دوره از محدوده مجاز خارج است");
   periodActivity.set(code,period);
  }
 }
 const trialBalance=accounts.map(account=>{
  const code=String(account.id),activity=allActivity.get(code)||{debit:0,credit:0};
  const openingDebit=Number(account.openingDebitRial||0),openingCredit=Number(account.openingCreditRial||0);
  if(!Number.isSafeInteger(openingDebit)||openingDebit<0||!Number.isSafeInteger(openingCredit)||openingCredit<0)throw new Error("مانده افتتاحیه حساب نامعتبر است");
  const net=openingDebit-openingCredit+activity.debit-activity.credit;
  return {...account,debit:activity.debit,credit:activity.credit,openingDebit,openingCredit,endingDebit:Math.max(0,net),endingCredit:Math.max(0,-net),net};
 });
 const byType=type=>trialBalance.filter(x=>x.type===type);
 const safeTotal=(rows,selector,label)=>{const total=rows.reduce((n,x)=>n+selector(x),0);if(!Number.isSafeInteger(total))throw new Error(label+" از محدوده عددی مجاز خارج است");return total};
 const assets=safeTotal(byType("ASSET"),x=>x.net,"جمع دارایی‌ها");
 const liabilities=safeTotal(byType("LIABILITY"),x=>-x.net,"جمع بدهی‌ها");
 const equityAccounts=safeTotal(byType("EQUITY"),x=>-x.net,"جمع حقوق مالکانه");
 const cumulativeRevenue=safeTotal(byType("REVENUE"),x=>-x.net,"جمع درآمدها");
 const cumulativeExpense=safeTotal(byType("EXPENSE"),x=>x.net,"جمع هزینه‌ها");
 const cumulativeProfit=cumulativeRevenue-cumulativeExpense;
 if(!Number.isSafeInteger(cumulativeProfit)||!Number.isSafeInteger(equityAccounts+cumulativeProfit))throw new Error("حقوق مالکانه از محدوده عددی مجاز خارج است");
 const equity=equityAccounts+cumulativeProfit;
 const periodRows=accounts.map(account=>{
  const activity=periodActivity.get(String(account.id))||{debit:0,credit:0};
  const amount=account.type==="REVENUE"?activity.credit-activity.debit:account.type==="EXPENSE"?activity.debit-activity.credit:0;
  return {...account,amount,debit:activity.debit,credit:activity.credit};
 }).filter(x=>(x.type==="REVENUE"||x.type==="EXPENSE")&&x.amount!==0);
 const revenueRows=periodRows.filter(x=>x.type==="REVENUE"),expenseRows=periodRows.filter(x=>x.type==="EXPENSE");
 const revenue=revenueRows.reduce((n,x)=>n+x.amount,0),expense=expenseRows.reduce((n,x)=>n+x.amount,0);
 if(!Number.isSafeInteger(revenue)||!Number.isSafeInteger(expense)||!Number.isSafeInteger(revenue-expense))throw new Error("جمع صورت سود و زیان از محدوده عددی مجاز خارج است");
 return {
  trialBalance,
  incomeStatement:{revenueRows,expenseRows,revenue,expense,netProfit:revenue-expense},
  balanceSheet:{assets,liabilities,equity,equityAccounts,cumulativeProfit,difference:assets-liabilities-equity},
  period:{fromDate,toDate}
 };
}
function buildPeriodClosingJournal(input){
 const accounts=input.accounts||[],vouchers=input.vouchers||[],voucherLines=input.voucherLines||[];
 const fromDate=Number(input.fromDate),toDate=Number(input.toDate),retainedEarningsCode=String(input.retainedEarningsCode||"3201");
 if(!Number.isFinite(fromDate)||!Number.isFinite(toDate)||fromDate>toDate)throw new Error("بازه بستن دوره معتبر نیست");
 const retained=accounts.find(a=>String(a.id)===retainedEarningsCode);
 if(!retained||retained.type!=="EQUITY")throw new Error("حساب سود و زیان انباشته تعریف نشده است");
 const byId=new Map(vouchers.map(v=>[Number(v.id),v])),activity=new Map();
 for(const line of voucherLines){
  const voucher=byId.get(Number(line.voucherId));if(!voucher)continue;
  const date=Number(voucher.date||0),reference=String(voucher.reference||"");
  if(date<fromDate||date>toDate||reference.startsWith("YEAR_END_CLOSE:"))continue;
  const code=String(line.accountCode),row=activity.get(code)||{debit:0,credit:0};
  row.debit+=Number(line.debitRial||0);row.credit+=Number(line.creditRial||0);
  if(!Number.isSafeInteger(row.debit)||!Number.isSafeInteger(row.credit))throw new Error("گردش دوره برای بستن حساب‌ها معتبر نیست");
  activity.set(code,row);
 }
 const lines=[];let revenue=0,expense=0;
 for(const account of accounts){
  if(account.type!=="REVENUE"&&account.type!=="EXPENSE")continue;
  const row=activity.get(String(account.id))||{debit:0,credit:0};
  const balance=account.type==="REVENUE"?row.credit-row.debit:row.debit-row.credit;
  if(!Number.isSafeInteger(balance))throw new Error("مانده حساب سود و زیان معتبر نیست");
  if(account.type==="REVENUE")revenue+=balance;else expense+=balance;
  if(balance>0)lines.push({accountCode:String(account.id),debitRial:account.type==="REVENUE"?balance:0,creditRial:account.type==="EXPENSE"?balance:0,description:"بستن حساب "+account.title});
  else if(balance<0)lines.push({accountCode:String(account.id),debitRial:account.type==="EXPENSE"?-balance:0,creditRial:account.type==="REVENUE"?-balance:0,description:"بستن حساب "+account.title});
 }
 const netProfit=revenue-expense;
 if(!Number.isSafeInteger(revenue)||!Number.isSafeInteger(expense)||!Number.isSafeInteger(netProfit))throw new Error("سود/زیان دوره از محدوده عددی مجاز خارج است");
 if(netProfit>0)lines.push({accountCode:retainedEarningsCode,debitRial:0,creditRial:netProfit,description:"انتقال سود دوره به سود و زیان انباشته"});
 else if(netProfit<0)lines.push({accountCode:retainedEarningsCode,debitRial:-netProfit,creditRial:0,description:"انتقال زیان دوره به سود و زیان انباشته"});
 const debit=lines.reduce((n,x)=>n+x.debitRial,0),credit=lines.reduce((n,x)=>n+x.creditRial,0);
 if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit)||debit!==credit)throw new Error("سند اختتامیه متوازن نیست");
 return {lines,revenue,expense,netProfit,debit,credit};
}
function hasOverlappingPeriodClose(vouchers,fromDate,toDate){
 if(!Number.isSafeInteger(fromDate)||!Number.isSafeInteger(toDate)||fromDate>toDate)throw new Error("بازه بستن دوره معتبر نیست");
 return (vouchers||[]).some(v=>{
  const match=/^YEAR_END_CLOSE:(\\d+):(\\d+)$/.exec(String(v.reference||""));
  if(!match)return false;
  const oldFrom=Number(match[1]),oldTo=Number(match[2]);
  return Number.isSafeInteger(oldFrom)&&Number.isSafeInteger(oldTo)&&oldFrom<=oldTo&&fromDate<=oldTo&&toDate>=oldFrom;
 });
}
const accountingReportsApi={buildFinancialStatements,buildPeriodClosingJournal,hasOverlappingPeriodClose};
if(typeof module!=="undefined"&&module.exports)module.exports=accountingReportsApi;
if(typeof globalThis!=="undefined")globalThis.HolooAccountingReports=accountingReportsApi;
