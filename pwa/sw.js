const CACHE="holloo-pwa-v127-cheque-search";
const ASSETS=["./","./index.html","./style.css","./app.js","./import-cost.js","./party-opening-balance.js","./settlement.js","./warehouse-stock.js","./warehouse-transfer.js","./foreign-currency.js","./accounting-reports.js","./receivables-aging.js","./import-shipment-analytics.js","./inventory-lots.js","./foreign-payables.js","./cash-flow-forecast.js","./import-capital-planner.js","./operation-date.js","./invoice-costing.js","./bank-reconciliation.js","./manifest.webmanifest","./icon.svg"];
const NETWORK_FIRST=/\/(?:index\.html|app\.js|import-cost\.js|party-opening-balance\.js|settlement\.js|warehouse-stock\.js|warehouse-transfer\.js|foreign-currency\.js|accounting-reports\.js|receivables-aging\.js|import-shipment-analytics\.js|inventory-lots\.js|foreign-payables\.js|cash-flow-forecast\.js|import-capital-planner\.js|operation-date\.js|invoice-costing\.js|bank-reconciliation\.js|style\.css|manifest\.webmanifest|sw\.js)(?:\?.*)?$/;
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(event.request.mode==="navigate"||NETWORK_FIRST.test(url.pathname)){
   try{
    const response=await fetch(event.request,{cache:"no-store"});
    if(response&&response.ok)await cache.put(event.request,response.clone());
    return response;
   }catch(error){
    return (await cache.match(event.request))||(await cache.match("./index.html"));
   }
  }
  const cached=await cache.match(event.request);
  if(cached)return cached;
  try{
   const response=await fetch(event.request);
   if(response&&response.ok)await cache.put(event.request,response.clone());
   return response;
  }catch(error){return cached||Response.error()}
 })());
});