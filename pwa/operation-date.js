"use strict";
const OPERATION_DATE_STORES=new Set(["invoices","treasury","vouchers","partyLedger","warehouseTransfers","stockAdjustments","inventoryLots","foreignPayablePayments","foreignPayables","importShipments","checks","salesOrders","payroll","assetDepreciations"]);
function parseOperationDate(value){
 const raw=String(value||"").trim(),m=/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2}))?$/.exec(raw);
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
 if(!record||typeof record!=="object"||!OPERATION_DATE_STORES.has(store)||mode!=="MANUAL")return record;
 const at=resolveOperationDate({mode,manualValue,now}),copy={...record};
 if(Object.prototype.hasOwnProperty.call(copy,"date"))copy.date=at;
 const fields={
  importShipments:["updatedAt","receivedAt"],inventoryLots:["receivedAt","transferredAt"],
  checks:["createdAt","statusChangedAt","clearedAt","endorsedAt","bouncedAt","cancelledAt"],
  salesOrders:["createdAt","updatedAt"],foreignPayables:["createdAt","updatedAt"]
 }[store]||[];
 for(const key of fields)if(Object.prototype.hasOwnProperty.call(copy,key)&&copy[key]!==null)copy[key]=at;
 return copy;
}
if(typeof module!=="undefined"&&module.exports)module.exports={parseOperationDate,resolveOperationDate,stampOperationRecord,OPERATION_DATE_STORES};
if(typeof globalThis!=="undefined")globalThis.HolooOperationDate={parseOperationDate,resolveOperationDate,stampOperationRecord};
