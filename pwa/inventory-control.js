const CODE39={
 "0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw","5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnwnnn",
 "A":"wnnnnwnnw","B":"nnwnnwnnw","C":"wnwnnwnnn","D":"nnnnwwnnw","E":"wnnnwwnnn","F":"nnwnwwnnn","G":"nnnnnwwnw","H":"wnnnnwwnn","I":"nnwnnwwnn","J":"nnnnwwwnn",
 "K":"wnnnnnnww","L":"nnwnnnnww","M":"wnwnnnnwn","N":"nnnnwnnww","O":"wnnnwnnwn","P":"nnwnwnnwn","Q":"nnnnnnwww","R":"wnnnnnwwn","S":"nnwnnnwwn","T":"nnnnwnwwn",
 "U":"wwnnnnnnw","V":"nwwnnnnnw","W":"www nn nnn".replace(/ /g,""),"X":"nwnnwnnnw","Y":"wwnnwnnnn","Z":"nwwnwnnnn",
 "-":"nwnnnnwnw",".":"wwnnnnwnn"," ":"nwwnnnwnn","$":"nwnwnwnnn","/":"nwnwnnnwn","+":"nwnnnwnwn","%":"nnnwnwnwn","*":"nwnnwnwnn"
};
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function code39Svg(raw,options={}){
 const value=String(raw??"").trim().toUpperCase();
 if(!value)throw new Error("بارکد خالی قابل چاپ نیست");
 if(value.length>48)throw new Error("طول بارکد برای برچسب بیشتر از ۴۸ نویسه است");
 const encoded="*"+value+"*";
 if([...encoded].some(char=>!CODE39[char]))throw new Error("بارکد فقط می‌تواند شامل حروف لاتین، عدد و نویسه‌های مجاز Code 39 باشد");
 const narrow=Number(options.narrowWidth||2),wide=Number(options.wideWidth||5),height=Number(options.height||64),quiet=Number(options.quietZone||12);
 if(![narrow,wide,height,quiet].every(Number.isFinite)||narrow<=0||wide<=narrow||height<20||quiet<4)throw new Error("ابعاد برچسب بارکد معتبر نیست");
 const bars=[];let x=quiet;
 for(let ci=0;ci<encoded.length;ci++){
  const pattern=CODE39[encoded[ci]];
  for(let i=0;i<pattern.length;i++){
   const width=pattern[i]==="w"?wide:narrow;
   if(i%2===0)bars.push('<rect x="'+x+'" y="2" width="'+width+'" height="'+height+'" fill="#000"/>');
   x+=width;
  }
  if(ci<encoded.length-1)x+=narrow;
 }
 const width=x+quiet,caption=escapeHtml(value);
 return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="بارکد '+caption+'" viewBox="0 0 '+width+' '+(height+26)+'" width="'+width+'" height="'+(height+26)+'"><rect width="100%" height="100%" fill="#fff"/>'+bars.join("")+'<text x="'+(width/2)+'" y="'+(height+21)+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#000">'+caption+'</text></svg>';
}
function buildInventoryMovements(input){
 const productId=Number(input.productId),warehouseId=input.warehouseId==null||input.warehouseId===""?null:Number(input.warehouseId);
 if(!Number.isSafeInteger(productId)||productId<=0)throw new Error("کالای معتبر برای کاردکس انتخاب کنید");
 if(warehouseId!==null&&(!Number.isSafeInteger(warehouseId)||warehouseId<=0))throw new Error("انبار انتخاب‌شده معتبر نیست");
 const rows=[];
 const add=(row)=>{if(Number.isFinite(row.date)&&Number.isFinite(row.quantityIn)&&Number.isFinite(row.quantityOut)&&Number.isSafeInteger(row.valueIn)&&Number.isSafeInteger(row.valueOut))rows.push(row)};
 for(const invoice of input.invoices||[]){
  if(invoice.status==="DRAFT"||!["PURCHASE","SALE"].includes(invoice.kind))continue;
  for(const [index,line] of (Array.isArray(invoice.lines)?invoice.lines:[]).entries()){
   if(Number(line.productId)!==productId)continue;
   const wid=Number(line.warehouseId||invoice.warehouseId||0);if(warehouseId!==null&&wid!==warehouseId)continue;
   const qty=Number(line.totalQty??line.qty??0);if(!Number.isFinite(qty)||qty<=0)continue;
   const inbound=invoice.kind==="PURCHASE";
   const allocated=Array.isArray(line.lotAllocations)?line.lotAllocations.reduce((n,x)=>n+Number(x.cogs||0),0):0;
   const amount=inbound?Number(line.inventoryCostRial??line.lineTotal??0):Number(line.cogs??(allocated||0));
   if(!Number.isSafeInteger(amount)||amount<0)throw new Error("بهای ردیف فاکتور برای کاردکس معتبر نیست");
   add({date:Number(invoice.date||0),type:inbound?"PURCHASE":"SALE",reference:String(invoice.number||invoice.id||""),description:(inbound?"خرید ":"فروش ")+(invoice.number||""),warehouseId:wid,quantityIn:inbound?qty:0,quantityOut:inbound?0:qty,valueIn:inbound?amount:0,valueOut:inbound?0:amount,sourceId:invoice.id??null,lineIndex:index});
   if(invoice.status==="REVERSED"){
    const reversalDate=Number(invoice.reversedAt??invoice.date??0);
    add({date:reversalDate,type:inbound?"PURCHASE_REVERSAL":"SALE_REVERSAL",reference:String(invoice.number||invoice.id||""),description:"برگشت "+(inbound?"خرید ":"فروش ")+(invoice.number||""),warehouseId:wid,quantityIn:inbound?0:qty,quantityOut:inbound?qty:0,valueIn:inbound?0:amount,valueOut:inbound?amount:0,sourceId:invoice.id??null,lineIndex:index});
   }
  }
 }
 for(const adjustment of input.adjustments||[]){
  if(Number(adjustment.productId)!==productId)continue;
  const wid=Number(adjustment.warehouseId||0);if(warehouseId!==null&&wid!==warehouseId)continue;
  const delta=Number(adjustment.deltaKg),value=Number(adjustment.valueRial||0);if(!Number.isFinite(delta)||delta===0||!Number.isSafeInteger(value)||value<0)continue;
  add({date:Number(adjustment.date||0),type:"ADJUSTMENT",reference:String(adjustment.number||adjustment.id||""),description:"اصلاح موجودی "+(adjustment.number||""),warehouseId:wid,quantityIn:delta>0?delta:0,quantityOut:delta<0?-delta:0,valueIn:delta>0?value:0,valueOut:delta<0?value:0,sourceId:adjustment.id??null});
 }
 for(const transfer of input.transfers||[]){
  if(Number(transfer.productId)!==productId)continue;
  const source=Number(transfer.sourceWarehouseId),destination=Number(transfer.destinationWarehouseId),qty=Number(transfer.quantity),value=Number(transfer.value||0);
  if(!Number.isFinite(qty)||qty<=0||!Number.isSafeInteger(value)||value<0)continue;
  if(warehouseId!==null&&source!==warehouseId&&destination!==warehouseId)continue;
  if(warehouseId===null||source===warehouseId)add({date:Number(transfer.date||0),type:"TRANSFER_OUT",reference:String(transfer.number||transfer.id||""),description:"انتقال به "+(transfer.destinationWarehouseName||destination),warehouseId:source,quantityIn:0,quantityOut:qty,valueIn:0,valueOut:value,sourceId:transfer.id??null});
  if(warehouseId===null||destination===warehouseId)add({date:Number(transfer.date||0),type:"TRANSFER_IN",reference:String(transfer.number||transfer.id||""),description:"انتقال از "+(transfer.sourceWarehouseName||source),warehouseId:destination,quantityIn:qty,quantityOut:0,valueIn:value,valueOut:0,sourceId:transfer.id??null});
  if(transfer.status==="REVERSED"||transfer.reversedAt){
   const reversalDate=Number(transfer.reversedAt||0);
   if(!Number.isFinite(reversalDate)||reversalDate<=0)throw new Error("تاریخ برگشت انتقال معتبر نیست");
   if(warehouseId===null||source===warehouseId)add({date:reversalDate,type:"TRANSFER_REVERSAL_IN",reference:String(transfer.number||transfer.id||""),description:"برگشت انتقال از "+(transfer.destinationWarehouseName||destination),warehouseId:source,quantityIn:qty,quantityOut:0,valueIn:value,valueOut:0,sourceId:transfer.id??null});
   if(warehouseId===null||destination===warehouseId)add({date:reversalDate,type:"TRANSFER_REVERSAL_OUT",reference:String(transfer.number||transfer.id||""),description:"برگشت انتقال به "+(transfer.sourceWarehouseName||source),warehouseId:destination,quantityIn:0,quantityOut:qty,valueIn:0,valueOut:value,sourceId:transfer.id??null});
  }
 }
 for(const shipment of input.shipments||[]){
  if(Number(shipment.productId)!==productId||!shipment.receivedAt)continue;
  const wid=Number(shipment.warehouseId||0);if(warehouseId!==null&&wid!==warehouseId)continue;
  const qty=Number(shipment.weight),value=Number(shipment.totalCost??0);if(!Number.isFinite(qty)||qty<=0||!Number.isSafeInteger(value)||value<0)continue;
  add({date:Number(shipment.receivedAt),type:"IMPORT_RECEIPT",reference:String(shipment.number||shipment.id||""),description:"رسید محموله "+(shipment.container||shipment.number||""),warehouseId:wid,quantityIn:qty,quantityOut:0,valueIn:value,valueOut:0,sourceId:shipment.id??null});
 }
 return rows.sort((a,b)=>a.date-b.date||String(a.reference).localeCompare(String(b.reference),"en")||String(a.type).localeCompare(String(b.type)));
}
function buildInventoryKardex(input){
 const movements=buildInventoryMovements(input),product=(input.products||[]).find(x=>Number(x.id)===Number(input.productId));
 const stockRows=input.warehouseStock||[];
 const current= input.warehouseId==null||input.warehouseId==="" ? {stock:Number(product?.stock||0),value:Number(product?.value||0)} :
  (stockRows.find(x=>Number(x.productId)===Number(input.productId)&&Number(x.warehouseId)===Number(input.warehouseId))||{stock:0,value:0});
 const netQty=movements.reduce((n,x)=>n+x.quantityIn-x.quantityOut,0),netValue=movements.reduce((n,x)=>n+x.valueIn-x.valueOut,0);
 let balanceQty=Number(current.stock)-netQty,balanceValue=Number(current.value)-netValue;
 if(!Number.isFinite(balanceQty)||balanceQty< -1e-6||!Number.isSafeInteger(balanceValue)||balanceValue<0)throw new Error("گردش تاریخی با مانده فعلی کالا سازگار نیست؛ کاردکس بدون اصلاح داده متوقف شد");
 const from=input.from?Number(input.from):null,to=input.to?Number(input.to):null;
 if(from!==null&&(!Number.isFinite(from)||to!==null&&from>to))throw new Error("بازه تاریخ کاردکس معتبر نیست");
 if(to!==null&&!Number.isFinite(to))throw new Error("تاریخ پایان کاردکس معتبر نیست");
 const opening=movements.filter(x=>from!==null&&x.date<from).reduce((s,x)=>({quantity:s.quantity+x.quantityIn-x.quantityOut,value:s.value+x.valueIn-x.valueOut}),{quantity:balanceQty,value:balanceValue});
 let q=opening.quantity,v=opening.value;
 const visible=movements.filter(x=>(from===null||x.date>=from)&&(to===null||x.date<=to)).map(x=>{q+=x.quantityIn-x.quantityOut;v+=x.valueIn-x.valueOut;if(q< -1e-6||v<0||!Number.isSafeInteger(v))throw new Error("مانده کاردکس منفی یا نامعتبر شد؛ منبع گردش‌ها را بررسی کنید");return {...x,balanceQty:Math.max(0,q),balanceValue:v}});
 return {opening,rows:visible,closing:{quantity:q,value:v},current:{quantity:Number(current.stock),value:Number(current.value)}};
}
function buildStagnantInventoryReport(input){
 const threshold=Number(input.staleDays??90),asOf=Number(input.asOf??Date.now());
 if(!Number.isSafeInteger(threshold)||threshold<1||!Number.isFinite(asOf))throw new Error("آستانه یا تاریخ گزارش کالای راکد معتبر نیست");
 const products=input.products||[],rows=[];
 for(const product of products){
  const stock=Number(product.stock||0),value=Number(product.value||0);if(!Number.isFinite(stock)||stock<=1e-9||!Number.isSafeInteger(value)||value<0)continue;
  const movements=buildInventoryMovements({...input,productId:product.id});
  const last=movements.filter(x=>x.date<=asOf).reduce((max,x)=>Math.max(max,x.date),0);
  const days=last?Math.floor((asOf-last)/86400000):null;
  if(days===null||days>=threshold)rows.push({productId:Number(product.id),sku:String(product.sku||""),name:String(product.name||""),stock,value,average:stock>0?value/stock:0,lastMovement:last||null,daysSinceLastMovement:days,status:days===null?"UNKNOWN":"STAGNANT"});
 }
 return rows.sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,"fa"));
}
function buildStocktakeSheet(input){
 const products=input.products||[],stockRows=input.stockRows||[],warehouseId=Number(input.warehouseId),legacyWarehouseId=Number(input.legacyWarehouseId);
 if(!Number.isSafeInteger(warehouseId)||warehouseId<=0)throw new Error("انبار معتبر برای انبارگردانی انتخاب کنید");
 const seen=new Set();
 return products.map(product=>{
  const productId=Number(product.id);
  if(!Number.isSafeInteger(productId)||productId<=0||seen.has(productId))throw new Error("فهرست کالاها دارای شناسه نامعتبر یا تکراری است");
  seen.add(productId);
  const rows=stockRows.filter(row=>Number(row.productId)===productId),matches=rows.filter(row=>Number(row.warehouseId)===warehouseId);
  if(matches.length>1)throw new Error("رکورد موجودی این کالا در انبار تکراری است");
  const row=matches[0]||null,legacy=!rows.length&&warehouseId===legacyWarehouseId;
  const expectedQty=Number(row?.stock??(legacy?product.stock||0:0)),expectedValue=Number(row?.value??(legacy?product.value||0:0));
  const productStock=Number(product.stock||0),productValue=Number(product.value||0);
  if(!Number.isFinite(expectedQty)||expectedQty<0||!Number.isSafeInteger(expectedValue)||expectedValue<0||!Number.isFinite(productStock)||productStock<0||!Number.isSafeInteger(productValue)||productValue<0)throw new Error("مانده دفتری کالا یا انبار معتبر نیست");
  return {productId,warehouseId,sku:String(product.sku||""),productName:String(product.name||""),expectedQty,expectedValue,expectedProductState:{stock:product.stock,value:product.value},expectedWarehouseState:row?{...row}:null,countedQty:null,appliedAt:null};
 });
}
function buildStocktakeComparison(input){
 const stockRows=input.stockRows||[],counts=input.counts||[],products=input.products||[];
 const seen=new Set(),result=[];
 for(const count of counts){
  const productId=Number(count.productId),warehouseId=Number(count.warehouseId),key=productId+":"+warehouseId;
  if(!Number.isSafeInteger(productId)||productId<=0||!Number.isSafeInteger(warehouseId)||warehouseId<=0||seen.has(key))throw new Error("ردیف شمارش نامعتبر یا تکراری است");
  seen.add(key);
  const product=products.find(x=>Number(x.id)===productId),row=stockRows.find(x=>Number(x.productId)===productId&&Number(x.warehouseId)===warehouseId);
  const hasSnapshot=count.expectedQty!==undefined||count.expectedValue!==undefined,counted=Number(count.countedQty);
  if(!product||!Number.isFinite(counted)||counted<0)throw new Error("کالا یا مقدار شمارش معتبر نیست");
  const expected=Number(hasSnapshot?count.expectedQty:(row?.stock??(stockRows.some(x=>Number(x.productId)===productId)?0:product.stock||0)));
  const value=Number(hasSnapshot?count.expectedValue:(row?.value??(stockRows.some(x=>Number(x.productId)===productId)?0:product.value||0)));
  if(!Number.isFinite(expected)||expected<0||!Number.isSafeInteger(value)||value<0)throw new Error("مانده دفتری انبار معتبر نیست");
  const delta=counted-expected,unitValue=expected>0?value/expected:Number(product.avg||0),valueDelta=Math.round(delta*unitValue);
  if(!Number.isSafeInteger(valueDelta))throw new Error("ارزش مغایرت شمارش از محدوده عددی خارج است");
  result.push({productId,warehouseId,productName:product.name||"",sku:product.sku||"",expectedQty:expected,expectedValue:value,countedQty:counted,deltaQty:delta,unitValue,valueDelta,status:Math.abs(delta)<1e-6?"MATCH":"DIFFERENCE"});
 }
 return result;
}
function buildReorderReport(input){
 const rows=[];
 for(const product of input.products||[]){
  const stock=Number(product.stock??0),minimum=Number(product.minStock??0),maximum=Number(product.maxStock??0),average=Number(product.avg??0);
  if(!Number.isFinite(stock)||stock<0||!Number.isFinite(minimum)||minimum<0||!Number.isFinite(maximum)||maximum<0||!Number.isFinite(average)||average<0)throw new Error("موجودی یا حدود سفارش کالا معتبر نیست");
  if(minimum<=0)continue;
  if(maximum>0&&maximum<minimum)throw new Error("حداکثر موجودی کالای "+String(product.name||product.sku||product.id)+" از حداقل کمتر است");
  if(stock>minimum)continue;
  const target=maximum>minimum?maximum:minimum,recommended=Math.max(0,target-stock),estimatedValue=Math.round(recommended*average);
  if(!Number.isSafeInteger(estimatedValue))throw new Error("ارزش پیشنهادی سفارش از محدوده عددی خارج است");
  rows.push({productId:Number(product.id),sku:String(product.sku||""),name:String(product.name||""),stock,minStock:minimum,maxStock:maximum,targetStock:target,recommendedQty:recommended,average,estimatedValue});
 }
 return rows.sort((a,b)=>b.recommendedQty-a.recommendedQty||b.estimatedValue-a.estimatedValue||a.name.localeCompare(b.name,"fa"));
}

function buildInventoryReconciliation(input){
 const products=Array.isArray(input.products)?input.products:[],stockRows=Array.isArray(input.warehouseStock)?input.warehouseStock:[],lots=Array.isArray(input.inventoryLots)?input.inventoryLots:[],accounts=Array.isArray(input.accounts)?input.accounts:[],vouchers=Array.isArray(input.vouchers)?input.vouchers:[],voucherLines=Array.isArray(input.voucherLines)?input.voucherLines:[];
 const discrepancies=[],productIds=new Set(products.map(row=>String(row.id))),voucherMap=new Map(vouchers.map(row=>[Number(row.id),row]));
 const add=(scope,metric,expected,actual,productId=null,warehouseId=null)=>{
  const difference=actual-expected;
  const mismatch=metric==="quantity"?Math.abs(difference)>1e-6:difference!==0;
  if(mismatch)discrepancies.push({scope,metric,expected,actual,difference,productId,warehouseId});
 };
 const qty=value=>{const n=Number(value||0);if(!Number.isFinite(n)||n< -1e-6)throw new Error("مقدار موجودی برای تطبیق معتبر نیست");return n};
 const rial=value=>{const n=Number(value||0);if(!Number.isSafeInteger(n)||n<0)throw new Error("ارزش موجودی برای تطبیق معتبر نیست");return n};
 const stockByProduct=new Map(),stockByWarehouse=new Map(),lotByProduct=new Map(),lotByWarehouse=new Map();
 for(const row of stockRows){
  const pid=String(row.productId),wid=String(row.warehouseId),key=pid+":"+wid;
  if(!productIds.has(pid))discrepancies.push({scope:"ORPHAN_WAREHOUSE_STOCK",metric:"missing_product",expected:"کالای ثبت‌شده",actual:pid,productId:row.productId,warehouseId:row.warehouseId});
  const s=stockByProduct.get(pid)||{quantity:0,value:0};s.quantity+=qty(row.stock);s.value+=rial(row.value);if(!Number.isSafeInteger(s.value))throw new Error("جمع ارزش موجودی انبارها از محدوده مجاز خارج است");stockByProduct.set(pid,s);
  const w=stockByWarehouse.get(key)||{quantity:0,value:0,count:0};w.quantity+=qty(row.stock);w.value+=rial(row.value);w.count++;if(!Number.isSafeInteger(w.value))throw new Error("جمع ارزش موجودی انبار از محدوده مجاز خارج است");stockByWarehouse.set(key,w);
 }
 for(const lot of lots){
  const pid=String(lot.productId),wid=String(lot.warehouseId),key=pid+":"+wid;
  if(!productIds.has(pid))discrepancies.push({scope:"ORPHAN_FIFO_LOT",metric:"missing_product",expected:"کالای ثبت‌شده",actual:pid,productId:lot.productId,warehouseId:lot.warehouseId});
  const q=qty(lot.remainingQty),v=rial(lot.remainingValue),p=lotByProduct.get(pid)||{quantity:0,value:0},w=lotByWarehouse.get(key)||{quantity:0,value:0};
  p.quantity+=q;p.value+=v;w.quantity+=q;w.value+=v;
  if(!Number.isSafeInteger(p.value)||!Number.isSafeInteger(w.value))throw new Error("جمع ارزش بچ‌های FIFO از محدوده مجاز خارج است");
  lotByProduct.set(pid,p);lotByWarehouse.set(key,w);
 }
 for(const product of products){
  const pid=String(product.id),warehouse=stockByProduct.get(pid)||{quantity:0,value:0},fifo=lotByProduct.get(pid)||{quantity:0,value:0};
  add("PRODUCT_WAREHOUSE","quantity",qty(product.stock),warehouse.quantity,product.id);
  add("PRODUCT_WAREHOUSE","value",rial(product.value),warehouse.value,product.id);
  add("PRODUCT_FIFO","quantity",qty(product.stock),fifo.quantity,product.id);
  add("PRODUCT_FIFO","value",rial(product.value),fifo.value,product.id);
 }
 const keys=new Set([...stockByWarehouse.keys(),...lotByWarehouse.keys()]);
 for(const [key,row] of stockByWarehouse){if(row.count>1){const [pid,wid]=key.split(":");discrepancies.push({scope:"DUPLICATE_WAREHOUSE_STOCK",metric:"row_count",expected:1,actual:row.count,productId:Number(pid),warehouseId:Number(wid)})}}
 for(const key of keys){
  const [pid,wid]=key.split(":"),stock=stockByWarehouse.get(key)||{quantity:0,value:0},fifo=lotByWarehouse.get(key)||{quantity:0,value:0};
  add("WAREHOUSE_FIFO","quantity",stock.quantity,fifo.quantity,Number(pid),Number(wid));
  add("WAREHOUSE_FIFO","value",stock.value,fifo.value,Number(pid),Number(wid));
 }
 const inventoryAccount=accounts.find(row=>String(row.id)==="1301");
 let inventoryLedgerBalance=null,productInventoryValue=products.reduce((sum,row)=>sum+rial(row.value),0);
 if(!Number.isSafeInteger(productInventoryValue))throw new Error("جمع ارزش کالاها از محدوده مجاز خارج است");
 if(!inventoryAccount)discrepancies.push({scope:"ACCOUNT_1301",metric:"missing",expected:productInventoryValue,actual:null,difference:null,productId:null,warehouseId:null});
 else{
  let debit=rial(inventoryAccount.openingDebitRial),credit=rial(inventoryAccount.openingCreditRial);
  for(const line of voucherLines){
   if(String(line.accountCode)!=="1301"||!voucherMap.has(Number(line.voucherId)))continue;
   const d=rial(line.debitRial),cr=rial(line.creditRial);debit+=d;credit+=cr;
   if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit))throw new Error("گردش حساب ۱۳۰۱ از محدوده مجاز خارج است");
  }
  inventoryLedgerBalance=debit-credit;
  add("ACCOUNT_1301","value",productInventoryValue,inventoryLedgerBalance);
 }
 return {balanced:discrepancies.length===0,productCount:products.length,warehouseStockRows:stockRows.length,lotCount:lots.length,productInventoryValue,inventoryLedgerBalance,discrepancies};
}
function buildInventoryCsv(rows,headers){
 const quote=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
 return "\uFEFF"+[headers,...rows].map(row=>row.map(quote).join(",")).join("\r\n");
}
if(typeof module!=="undefined"&&module.exports)module.exports={code39Svg,buildInventoryMovements,buildInventoryKardex,buildStagnantInventoryReport,buildReorderReport,buildStocktakeSheet,buildStocktakeComparison,buildInventoryCsv,buildInventoryReconciliation};
if(typeof globalThis!=="undefined")globalThis.HolooInventoryControl={code39Svg,buildInventoryMovements,buildInventoryKardex,buildStagnantInventoryReport,buildReorderReport,buildStocktakeSheet,buildStocktakeComparison,buildInventoryCsv,buildInventoryReconciliation};
