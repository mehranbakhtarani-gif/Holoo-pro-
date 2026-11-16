"use strict";
const OPERATION_DATE_STORES=new Set(["accounts","parties","invoices","salesOrders","imports","checks","treasury","vouchers","partyLedger","warehouseTransfers","stockAdjustments","inventoryLots","foreignPayables","foreignPayablePayments","importShipments","approvals","payroll","fixedAssets","assetDepreciations","treasuryAllocations"]);
function parseOperationDate(value){
 const raw=String(value||"").trim(),m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
 if(!m)throw new Error("تاریخ و ساعت دستی را کامل و معتبر وارد کنید");
 const [,ys,mos,ds,hs,mis,ss="00"]=m,y=Number(ys),mo=Number(mos),d=Number(ds),h=Number(hs),mi=Number(mis),sec=Number(ss);
 const date=new Date(y,mo-1,d,h,mi,sec,0);
 if(date.getFullYear()!==y||date.getMonth()!==mo-1||date.getDate()!==d||date.getHours()!==h||date.getMinutes()!==mi||date.getSeconds()!==sec)throw new Error("تاریخ و ساعت دستی معتبر نیست");
 const timestamp=date.getTime();if(!Number.isSafeInteger(timestamp))throw new Error("تاریخ انتخاب‌شده خارج از محدوده مجاز است");
 return timestamp;
}
function resolveOperationDate({mode="AUTO",manualValue="",now=Date.now()}={}){
 if(mode==="MANUAL")return parseOperationDate(manualValue);
 if(mode!=="AUTO")throw new Error("حالت تاریخ عملیات معتبر نیست");
 if(!Number.isSafeInteger(now)||now<0)throw new Error("زمان سیستم معتبر نیست");
 return now;
}
function stampOperationRecord({store,record,mode="AUTO",manualValue="",now=Date.now()}={}){
 if(!record||typeof record!=="object"||!OPERATION_DATE_STORES.has(store))return record;
 const copy={...record},at=resolveOperationDate({mode,manualValue,now}),hasDate=Object.prototype.hasOwnProperty.call(copy,"date"),freshDate=hasDate&&Number.isFinite(Number(copy.date))&&Math.abs(now-Number(copy.date))<=60000;
 if(mode==="MANUAL"?(!hasDate||freshDate):!hasDate)copy.date=at;
 const updatedFields={
  importShipments:["updatedAt"],salesOrders:["updatedAt"],foreignPayables:["updatedAt"],approvals:["updatedAt"]
 }[store]||[];
 for(const key of updatedFields)if(Object.prototype.hasOwnProperty.call(copy,key)&&copy[key]!==null)copy[key]=at;
 if(mode==="MANUAL"){
  const eventFields={
   invoices:["createdAt","reversedAt"],foreignPayablePayments:["reversedAt"],importShipments:["receivedAt","statusChangedAt"],inventoryLots:["receivedAt","transferredAt"],
   checks:["createdAt","statusChangedAt","clearedAt","endorsedAt","bouncedAt","cancelledAt"],
   treasury:["reversedAt"],
   treasuryAllocations:["reversedAt"],
   salesOrders:["createdAt"],foreignPayables:["createdAt"],payroll:["createdAt","paidAt"]
  }[store]||[];
  for(const key of eventFields)if(Object.prototype.hasOwnProperty.call(copy,key)&&copy[key]!==null&&Number.isFinite(Number(copy[key]))&&Math.abs(now-Number(copy[key]))<=60000)copy[key]=at;
 }
 return copy;
}
if(typeof module!=="undefined"&&module.exports)module.exports={parseOperationDate,resolveOperationDate,stampOperationRecord,OPERATION_DATE_STORES};
if(typeof globalThis!=="undefined")globalThis.HolooOperationDate={parseOperationDate,resolveOperationDate,stampOperationRecord};
