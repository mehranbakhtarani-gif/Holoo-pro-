"use strict";
function addCashSafe(a,b,label="جمع جریان نقدی"){const value=a+b;if(!Number.isSafeInteger(value))throw new Error(label+" از محدوده عددی مجاز خارج است");return value}
function subtractCashSafe(a,b,label="خالص جریان نقدی"){const value=a-b;if(!Number.isSafeInteger(value))throw new Error(label+" از محدوده عددی مجاز خارج است");return value}
function calculateCashOpeningBalances(input){
 const accounts=Array.isArray(input.accounts)?input.accounts:[],lines=Array.isArray(input.voucherLines)?input.voucherLines:[];
 const balanceFor=code=>{
  const account=accounts.find(x=>String(x.id)===code&&x.type==="ASSET");
  if(!account)return 0;
  const debit=Number(account.openingDebitRial||0),credit=Number(account.openingCreditRial||0);
  if(!Number.isSafeInteger(debit)||debit<0||!Number.isSafeInteger(credit)||credit<0)throw new Error("مانده افتتاحیه صندوق یا بانک معتبر نیست");
  let balance=subtractCashSafe(debit,credit,"مانده افتتاحیه صندوق یا بانک");
  for(const line of lines.filter(x=>String(x.accountCode)===code)){
   const lineDebit=Number(line.debitRial||0),lineCredit=Number(line.creditRial||0);
   if(!Number.isSafeInteger(lineDebit)||lineDebit<0||!Number.isSafeInteger(lineCredit)||lineCredit<0)throw new Error("گردش صندوق یا بانک معتبر نیست");
   balance=addCashSafe(balance,lineDebit,"جمع بدهکار صندوق یا بانک");
   balance=subtractCashSafe(balance,lineCredit,"مانده صندوق یا بانک");
  }
  return balance;
 };
 const sumGroup=prefix=>accounts.filter(x=>x.type==="ASSET"&&String(x.id).startsWith(prefix)).reduce((total,account)=>addCashSafe(total,balanceFor(String(account.id)),"جمع مانده حساب‌های صندوق یا بانک"),0);
 const cashOnHandRial=sumGroup("1101"),bankBalanceRial=sumGroup("1102"),openingCashRial=addCashSafe(cashOnHandRial,bankBalanceRial,"جمع نقد و بانک");
 return {cashOnHandRial,bankBalanceRial,openingCashRial};
}
function buildCashFlowForecast(input){
 const asOf=input.asOf===undefined||input.asOf===null?Date.now():Number(input.asOf),days=Number(input.horizonDays===undefined?90:input.horizonDays),opening=Number(input.openingCashRial||0),events=Array.isArray(input.events)?input.events:[];
 if(!Number.isSafeInteger(asOf)||!Number.isSafeInteger(days)||![30,60,90].includes(days)||!Number.isSafeInteger(opening))throw new Error("پارامترهای پیش‌بینی جریان نقدی معتبر نیست");
 const start=new Date(asOf);if(!Number.isFinite(start.getTime()))throw new Error("تاریخ مبنای پیش‌بینی معتبر نیست");start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+days);if(!Number.isFinite(end.getTime()))throw new Error("پایان بازه پیش‌بینی معتبر نیست");
 const result={asOf:start.getTime(),horizonDays:days,openingCashRial:opening,expectedInflowsRial:0,expectedOutflowsRial:0,overdueInflowsRial:0,overdueOutflowsRial:0,undatedInflowsRial:0,undatedOutflowsRial:0,overdueCount:0,undatedCount:0,eventsCount:0,weekly:[],closingCashRial:opening,minimumProjectedCashRial:opening};
 const weekCount=Math.ceil(days/7);
 for(let i=0;i<weekCount;i++){const from=new Date(start);from.setDate(from.getDate()+i*7);const to=new Date(from);to.setDate(to.getDate()+7);result.weekly.push({from:from.getTime(),to:Math.min(to.getTime(),end.getTime()),inflowsRial:0,outflowsRial:0,netRial:0,closingCashRial:0,count:0})}
 const valid=[];
 for(const event of events){
  if(!event)continue;
  if(!["INFLOW","OUTFLOW"].includes(event.direction))throw new Error("جهت یکی از رویدادهای جریان نقدی معتبر نیست");
  const amount=Number(event.amountRial);if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("مبلغ یکی از رویدادهای جریان نقدی معتبر نیست");
  const due=event.dueDate===null||event.dueDate===undefined||event.dueDate===""?0:Number(event.dueDate);
  if(due!==0&&(!Number.isSafeInteger(due)||due<0))throw new Error("تاریخ سررسید یکی از رویدادها معتبر نیست");
  const record={...event,amountRial:amount,dueDate:due>0?due:null};
  if(!record.dueDate){if(record.direction==="INFLOW")result.undatedInflowsRial=addCashSafe(result.undatedInflowsRial,amount,"جمع ورودی‌های بدون سررسید");else result.undatedOutflowsRial=addCashSafe(result.undatedOutflowsRial,amount,"جمع خروجی‌های بدون سررسید");result.undatedCount++;continue}
  if(record.dueDate<start.getTime()){if(record.direction==="INFLOW")result.overdueInflowsRial=addCashSafe(result.overdueInflowsRial,amount,"جمع ورودی‌های سررسیدگذشته");else result.overdueOutflowsRial=addCashSafe(result.overdueOutflowsRial,amount,"جمع خروجی‌های سررسیدگذشته");result.overdueCount++;continue}
  if(record.dueDate>=end.getTime())continue;
  const index=Math.min(weekCount-1,Math.floor((record.dueDate-start.getTime())/(7*86400000))),bucket=result.weekly[index];
  if(record.direction==="INFLOW"){bucket.inflowsRial=addCashSafe(bucket.inflowsRial,amount,"جمع ورودی هفتگی");result.expectedInflowsRial=addCashSafe(result.expectedInflowsRial,amount,"جمع ورودی‌های پیش‌بینی‌شده")}
  else{bucket.outflowsRial=addCashSafe(bucket.outflowsRial,amount,"جمع خروجی هفتگی");result.expectedOutflowsRial=addCashSafe(result.expectedOutflowsRial,amount,"جمع خروجی‌های پیش‌بینی‌شده")}
  bucket.count++;valid.push(record);result.eventsCount++;
 }
 let balance=opening;
 for(const bucket of result.weekly){bucket.netRial=subtractCashSafe(bucket.inflowsRial,bucket.outflowsRial);balance=addCashSafe(balance,bucket.netRial,"مانده نقد پایان هفته");bucket.closingCashRial=balance}
 const daily=new Map();
 for(const event of valid){const key=new Date(event.dueDate).setHours(0,0,0,0),row=daily.get(key)||{inflows:0,outflows:0};if(event.direction==="INFLOW")row.inflows+=event.amountRial;else row.outflows+=event.amountRial;daily.set(key,row)}
 let dailyBalance=opening;
 for(const [,row] of [...daily.entries()].sort((a,b)=>a[0]-b[0])){dailyBalance=addCashSafe(dailyBalance,subtractCashSafe(row.inflows,row.outflows),"مانده نقد روزانه");result.minimumProjectedCashRial=Math.min(result.minimumProjectedCashRial,dailyBalance)}
 result.closingCashRial=balance;
 return result;
}
function getDailyCashFlowProjection(input){
 const asOf=input.asOf===undefined||input.asOf===null?Date.now():Number(input.asOf),days=Number(input.horizonDays===undefined?90:input.horizonDays),opening=Number(input.openingCashRial||0),events=Array.isArray(input.events)?input.events:[];
 if(!Number.isSafeInteger(asOf)||!Number.isSafeInteger(days)||![30,60,90].includes(days)||!Number.isSafeInteger(opening))throw new Error("پارامترهای پیش‌بینی روزانه معتبر نیست");
 const start=new Date(asOf);if(!Number.isFinite(start.getTime()))throw new Error("تاریخ مبنای پیش‌بینی روزانه معتبر نیست");start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+days);if(!Number.isFinite(end.getTime()))throw new Error("پایان بازه پیش‌بینی روزانه معتبر نیست");const daily=new Map();
 for(const event of events){if(!event||!["INFLOW","OUTFLOW"].includes(event.direction))continue;const amount=Number(event.amountRial),due=Number(event.dueDate||0);if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(due)||due<start.getTime()||due>=end.getTime())continue;const date=new Date(due);date.setHours(0,0,0,0);const key=date.getTime(),row=daily.get(key)||{inflowsRial:0,outflowsRial:0};if(event.direction==="INFLOW")row.inflowsRial=addCashSafe(row.inflowsRial,amount,"جمع ورودی روزانه");else row.outflowsRial=addCashSafe(row.outflowsRial,amount,"جمع خروجی روزانه");daily.set(key,row)}
 const rows=[];let balance=opening;for(let cursor=new Date(start);cursor<end;cursor.setDate(cursor.getDate()+1)){const date=cursor.getTime(),totals=daily.get(date)||{inflowsRial:0,outflowsRial:0};balance=addCashSafe(balance,subtractCashSafe(totals.inflowsRial,totals.outflowsRial),"مانده نقد روزانه");rows.push({date,inflowsRial:totals.inflowsRial,outflowsRial:totals.outflowsRial,closingCashRial:balance,shortfall:balance<0})}return rows;
}
if(typeof module!=="undefined"&&module.exports)module.exports={buildCashFlowForecast,getDailyCashFlowProjection,calculateCashOpeningBalances};
