"use strict";
function buildCashFlowForecast(input){
 const asOf=Number(input.asOf||Date.now()),days=Number(input.horizonDays===undefined?90:input.horizonDays),opening=Number(input.openingCashRial||0),events=Array.isArray(input.events)?input.events:[];
 if(!Number.isFinite(asOf)||!Number.isSafeInteger(days)||![30,60,90].includes(days)||!Number.isSafeInteger(opening))throw new Error("پارامترهای پیش‌بینی جریان نقدی معتبر نیست");
 const start=new Date(asOf);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+days+1);
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
 for(const bucket of result.weekly){bucket.netRial=bucket.inflowsRial-bucket.outflowsRial;balance+=bucket.netRial;bucket.closingCashRial=balance;result.minimumProjectedCashRial=Math.min(result.minimumProjectedCashRial,balance)}
 result.closingCashRial=balance;
 return result;
}
if(typeof module!=="undefined"&&module.exports)module.exports={buildCashFlowForecast};
