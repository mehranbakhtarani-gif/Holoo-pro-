function buildReceivablePayableAging(input){
 const invoices=Array.isArray(input.invoices)?input.invoices:[],allocations=Array.isArray(input.allocations)?input.allocations:[],asOfDate=Number(input.asOfDate??Date.now());
 if(!Number.isFinite(asOfDate))throw new Error("تاریخ مبنای گزارش معتبر نیست");
 const buckets=[{key:"current",label:"سررسیدنشده / سررسید امروز",min:0,max:0},{key:"1_30",label:"۱ تا ۳۰ روز",min:1,max:30},{key:"31_60",label:"۳۱ تا ۶۰ روز",min:31,max:60},{key:"61_90",label:"۶۱ تا ۹۰ روز",min:61,max:90},{key:"over_90",label:"بیش از ۹۰ روز",min:91,max:Infinity}];
 const groups={SALE:[],PURCHASE:[]};
 for(const invoice of invoices){
  if(!invoice||(invoice.status&&invoice.status!=="POSTED")||!["SALE","PURCHASE"].includes(invoice.kind))continue;
  const total=Number(invoice.total||0);
  if(!Number.isSafeInteger(total)||total<0)throw new Error("مبلغ فاکتور برای گزارش سنی معتبر نیست: "+String(invoice.number||""));
  const paid=allocations.filter(row=>row.invoiceNumber===invoice.number&&row.status!=="REVERSED").reduce((sum,row)=>sum+Number(row.amount||0),0);
  if(!Number.isSafeInteger(paid)||paid<0)throw new Error("جمع تخصیص‌های فاکتور معتبر نیست: "+String(invoice.number||""));
  if(paid>total)throw new Error("جمع تخصیص‌های فاکتور از مبلغ کل بیشتر است: "+String(invoice.number||""));
  const outstanding=total-paid;
  if(outstanding===0)continue;
  const hasDueDate=Number.isFinite(Number(invoice.dueDate))&&Number(invoice.dueDate)>0;
  const dueDate=hasDueDate?Number(invoice.dueDate):Number(invoice.date||0);
  if(!Number.isFinite(dueDate)||dueDate<=0)throw new Error("تاریخ فاکتور/سررسید معتبر نیست: "+String(invoice.number||""));
  const overdueDays=Math.max(0,Math.floor((asOfDate-dueDate)/86400000));
  const bucket=overdueDays===0?buckets[0]:buckets.find(x=>overdueDays>=x.min&&overdueDays<=x.max);
  groups[invoice.kind].push({...invoice,paid,outstanding,dueDate,overdueDays,bucket:bucket.key,bucketLabel:bucket.label,dueDateSource:hasDueDate?"INVOICE_DUE_DATE":"INVOICE_DATE"});
 }
 const summarize=rows=>{
  const total=rows.reduce((n,x)=>n+x.outstanding,0);
  if(!Number.isSafeInteger(total))throw new Error("جمع مانده گزارش سنی از محدوده عددی مجاز خارج است");
  const byBucket=buckets.map(bucket=>{const selected=rows.filter(x=>x.bucket===bucket.key);return {key:bucket.key,label:bucket.label,amount:selected.reduce((n,x)=>n+x.outstanding,0),count:selected.length}});
  const byParty=new Map();
  for(const row of rows){const key=String(row.partyId??row.partyName??"unknown"),item=byParty.get(key)||{partyId:row.partyId??null,partyName:row.partyName||"بدون نام",amount:0,count:0};item.amount+=row.outstanding;item.count++;byParty.set(key,item)}
  return {total,count:rows.length,byBucket,byParty:[...byParty.values()].sort((a,b)=>b.amount-a.amount)};
 };
 return {asOfDate,receivables:{...summarize(groups.SALE),rows:groups.SALE.sort((a,b)=>a.dueDate-b.dueDate)},payables:{...summarize(groups.PURCHASE),rows:groups.PURCHASE.sort((a,b)=>a.dueDate-b.dueDate)}};
}
if(typeof module!=="undefined"&&module.exports)module.exports={buildReceivablePayableAging};
