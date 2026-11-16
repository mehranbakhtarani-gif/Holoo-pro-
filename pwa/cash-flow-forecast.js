"use strict";
function buildCashFlowForecast(input){
 const asOf=Number(input.asOf||Date.now()),days=Number(input.horizonDays===undefined?90:input.horizonDays),opening=Number(input.openingCashRial||0),events=Array.isArray(input.events)?input.events:[];
 if(!Number.isFinite(asOf)||!Number.isSafeInteger(days)||![30,60,90].includes(days)||!Number.isSafeInteger(opening))throw new Error("پارامترهای پیش‌بینی جریان نقدی معتبر نیست");
 const start=new Date(asOf);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+days);
 const result={asOf:start.getTime(),horizonDays:days,openingCashRial:opening,expectedInflowsRial:0,expectedOutflowsRial:0,overdueInflowsRial:0,overdueOutflowsRial:0,undatedInflowsRial:0,undatedOutflowsRial:0,overdueCount:0,undatedCount:0,eventsCount:0,weekly:[],closingCashRial:opening,minimumProjectedCashRial:opening};
 const weekCount=Math.ceil(days/7);
 for(let i=0;i<weekCount;i++){const from=new Date(start);from.setDate(from.getDate()+i*7);const to=new Date(from);to.setDate(to.getDate()+7);result.weekly.push({from:from.getTime(),to:Math.min(to.getTime(),end.getTime()),inflowsRial:0,outflowsRial:0,netRial:0,closingCashRial:0,count:0})}
 const valid=[];
 for(const event of events){
  if(!event)continue;
  if(!["INFLOW","OUTFLOW"].includes(event.direction))throw new Error("جهت یکی از رویدادهای جریان نقدی معتبر نیست");
  const amount=Number(event.amountRial);if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("مبلغ یکی از رویدادهای جریان نقدی معتبر نیست");
  const due=Number(event.dueDate||0),record={...event,amountRial:amount,dueDate:Number.isFinite(due)&&due>0?due:null};
  if(!record.dueDate){if(record.direction==="INFLOW")result.undatedInflowsRial+=amount;else result.undatedOutflowsRial+=amount;result.undatedCount++;continue}
  if(record.dueDate<start.getTime()){if(record.direction==="INFLOW")result.overdueInflowsRial+=amount;else result.overdueOutflowsRial+=amount;result.overdueCount++;continue}
  if(record.dueDate>=end.getTime())continue;
  const index=Math.min(weekCount-1,Math.floor((record.dueDate-start.getTime())/(7*86400000))),bucket=result.weekly[index];
  if(record.direction==="INFLOW"){bucket.inflowsRial+=amount;result.expectedInflowsRial+=amount}
  else{bucket.outflowsRial+=amount;result.expectedOutflowsRial+=amount}
  bucket.count++;valid.push(record);result.eventsCount++;
 }
 let balance=opening;
 for(const bucket of result.weekly){bucket.netRial=bucket.inflowsRial-bucket.outflowsRial;balance+=bucket.netRial;bucket.closingCashRial=balance}
 const daily=new Map();
 for(const event of valid){const key=new Date(event.dueDate).setHours(0,0,0,0),row=daily.get(key)||{inflows:0,outflows:0};if(event.direction==="INFLOW")row.inflows+=event.amountRial;else row.outflows+=event.amountRial;daily.set(key,row)}
 let dailyBalance=opening;
 for(const [,row] of [...daily.entries()].sort((a,b)=>a[0]-b[0])){dailyBalance+=row.inflows-row.outflows;result.minimumProjectedCashRial=Math.min(result.minimumProjectedCashRial,dailyBalance)}
 result.closingCashRial=balance;
 return result;
}
function getDailyCashFlowProjection(input){
 const asOf=Number(input.asOf||Date.now()),days=Number(input.horizonDays===undefined?90:input.horizonDays),opening=Number(input.openingCashRial||0),events=Array.isArray(input.events)?input.events:[];
 if(!Number.isFinite(asOf)||!Number.isSafeInteger(days)||![30,60,90].includes(days)||!Number.isSafeInteger(opening))throw new Error("پارامترهای پیش‌بینی روزانه معتبر نیست");
 const start=new Date(asOf);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+days);const daily=new Map();
 for(const event of events){if(!event||!["INFLOW","OUTFLOW"].includes(event.direction))continue;const amount=Number(event.amountRial),due=Number(event.dueDate||0);if(!Number.isSafeInteger(amount)||amount<=0||!Number.isFinite(due)||due<start.getTime()||due>=end.getTime())continue;const date=new Date(due);date.setHours(0,0,0,0);const key=date.getTime(),row=daily.get(key)||{inflowsRial:0,outflowsRial:0};if(event.direction==="INFLOW")row.inflowsRial+=amount;else row.outflowsRial+=amount;daily.set(key,row)}
 const rows=[];let balance=opening;for(let cursor=new Date(start);cursor<end;cursor.setDate(cursor.getDate()+1)){const date=cursor.getTime(),totals=daily.get(date)||{inflowsRial:0,outflowsRial:0};balance+=totals.inflowsRial-totals.outflowsRial;rows.push({date,inflowsRial:totals.inflowsRial,outflowsRial:totals.outflowsRial,closingCashRial:balance,shortfall:balance<0})}return rows;
}
if(typeof module!=="undefined"&&module.exports)module.exports={buildCashFlowForecast,getDailyCashFlowProjection};
