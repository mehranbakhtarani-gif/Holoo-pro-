// Normalize both signed-amount and bank-specific debit/credit CSV layouts.
function parseBankCsv(text,defaultBank=""){
 const source=String(text||"").replace(/^\uFEFF/,"");
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<source.length;i++){
  const ch=source[i],next=source[i+1];
  if(quoted){if(ch==='"'&&next==='"'){field+='"';i++}else if(ch==='"')quoted=false;else field+=ch;continue}
  if(ch==='"'){quoted=true;continue}
  if(ch===","){row.push(field.trim());field="";continue}
  if(ch==="\n"||ch==="\r"){if(ch==="\r"&&next==="\n")i++;row.push(field.trim());field="";if(row.some(x=>x!==""))rows.push(row);row=[];continue}
  field+=ch;
 }
 if(quoted)throw new Error("ساختار CSV ناقص است؛ کوتیشن بسته نشده");
 row.push(field.trim());if(row.some(x=>x!==""))rows.push(row);
 if(rows.length<2)throw new Error("فایل CSV باید ردیف عنوان و حداقل یک تراکنش داشته باشد");
 const normalize=s=>String(s||"").trim().toLowerCase().replace(/\s+/g," ");
 const aliases={
  date:["date","تاریخ","تاریخ تراکنش","transaction date"],
  amount:["amount","مبلغ","مبلغ ریال","مبلغ تراکنش","signed amount"],
  debit:["debit","withdrawal","برداشت","مبلغ برداشت","بدهکار"],
  credit:["credit","deposit","واریز","مبلغ واریز","بستانکار"],
  description:["description","شرح","توضیحات","شرح تراکنش"],
  reference:["reference","ref","شماره مرجع","شناسه","کد رهگیری"],
  bank:["bank","بانک","نام بانک"]
 };
 const header=rows[0].map(normalize),columns={};
 for(const [key,names] of Object.entries(aliases)){const index=header.findIndex(x=>names.includes(x));if(index>=0)columns[key]=index}
 if(columns.date===undefined)throw new Error("ستون تاریخ در CSV الزامی است");
 const hasSigned=columns.amount!==undefined,hasDebit=columns.debit!==undefined,hasCredit=columns.credit!==undefined;
 if(!hasSigned&&!(hasDebit&&hasCredit))throw new Error("ستون مبلغ یا هر دو ستون برداشت و واریز در CSV الزامی هستند");
 const digits=s=>String(s).replace(/[۰-۹٠-٩]/g,ch=>{const p="۰۱۲۳۴۵۶۷۸۹",a="٠١٢٣٤٥٦٧٨٩",n=p.indexOf(ch);return n>=0?String(n):String(a.indexOf(ch))});
 const parseDate=value=>{const raw=digits(value).trim();if(/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(raw)){const t=new Date(raw.replace(/\//g,"-")+"T12:00:00").getTime();if(Number.isFinite(t))return t}const t=new Date(raw).getTime();if(Number.isFinite(t))return t;throw new Error("تاریخ نامعتبر در صورت‌حساب بانکی: "+value)};
 const parseAmount=value=>{const raw=digits(value).replace(/[٬،,\s]/g,"").replace(/[()]/g,"");const n=Number(raw);if(!Number.isSafeInteger(n)||n===0)throw new Error("مبلغ نامعتبر در صورت‌حساب بانکی: "+value);return String(value).includes("(")?-Math.abs(n):n};
 const parseColumnMagnitude=value=>{const raw=digits(value||"0").replace(/[٬،,\s]/g,"").replace(/[()]/g,"");const n=raw===""?0:Number(raw);if(!Number.isSafeInteger(n)||n<0)throw new Error("مبلغ ستون برداشت/واریز نامعتبر است: "+value);return n};
 return rows.slice(1).map((cells,index)=>{
  const date=parseDate(cells[columns.date]||"");
  let signedAmount;
  if(hasSigned)signedAmount=parseAmount(cells[columns.amount]||"");
  else{const debit=parseColumnMagnitude(cells[columns.debit]),credit=parseColumnMagnitude(cells[columns.credit]);if(debit>0&&credit>0)throw new Error("در یک ردیف، برداشت و واریز نمی‌توانند هم‌زمان مبلغ داشته باشند");signedAmount=credit-debit;if(!Number.isSafeInteger(signedAmount)||signedAmount===0)throw new Error("ردیف باید فقط یک مبلغ معتبر برداشت یا واریز داشته باشد");}
  return {lineNumber:index+2,date,signedAmount,description:columns.description===undefined?"":cells[columns.description]||"",reference:columns.reference===undefined?"":cells[columns.reference]||"",bank:columns.bank===undefined?String(defaultBank||""):cells[columns.bank]||String(defaultBank||""),status:"UNMATCHED",matchedTreasuryId:null,candidateTreasuryIds:[]};
 });
}
function getTreasurySignedAmount(row){return row.kind==="RECEIPT"?Number(row.amount):-Number(row.amount)}
function normalizeBankIdentity(value){
 return String(value||"").normalize("NFKC").replace(/[يى]/g,"ی").replace(/ك/g,"ک").toLocaleLowerCase("fa").replace(/[\s\u200c\-_/\.،,()]+/g,"").trim();
}
function bankIdentityMatches(line,row){
 const statementBank=normalizeBankIdentity(line&&line.bank),accountName=normalizeBankIdentity(row&&row.accountName),accountCode=String(row&&row.accountCode||"");
 if(accountCode&&!/^1102\d*$/.test(accountCode))return false;
 if(!statementBank)return true;
 if(!accountName)return false;
 return accountName===statementBank||accountName.includes(statementBank)||statementBank.includes(accountName);
}
function findBankMatchCandidates(line,treasury,matchedTreasuryIds=[],toleranceDays=3){
 const used=new Set(matchedTreasuryIds.map(Number)),tolerance=toleranceDays*86400000;
 return (treasury||[]).filter(row=>row.method==="بانک"&&row.status!=="REVERSED"&&!used.has(Number(row.id))&&bankIdentityMatches(line,row)&&getTreasurySignedAmount(row)===Number(line.signedAmount)&&Math.abs(Number(row.date)-Number(line.date))<=tolerance)
  .sort((a,b)=>Math.abs(Number(a.date)-Number(line.date))-Math.abs(Number(b.date)-Number(line.date)));
}
function autoMatchBankLines(lines,treasury,toleranceDays=3){
 const used=new Set((lines||[]).filter(x=>x.status==="MATCHED"&&x.matchedTreasuryId).map(x=>Number(x.matchedTreasuryId)));
 return (lines||[]).map(line=>{
  if(line.status==="MATCHED")return line;
  const candidates=findBankMatchCandidates(line,treasury,[...used],toleranceDays);
  if(candidates.length===1){used.add(Number(candidates[0].id));return {...line,status:"MATCHED",matchedTreasuryId:candidates[0].id,candidateTreasuryIds:[]}}
  if(candidates.length>1)return {...line,status:"SUGGESTED",matchedTreasuryId:null,candidateTreasuryIds:candidates.map(x=>x.id)};
  return {...line,status:"UNMATCHED",matchedTreasuryId:null,candidateTreasuryIds:[]};
 });
}
function validateBankManualMatch(line,treasury,matchedTreasuryIds=[]){
 if(!line||line.status==="MATCHED")throw new Error("این ردیف قبلاً تطبیق داده شده است");
 if(!treasury||treasury.method!=="بانک"||treasury.status==="REVERSED")throw new Error("گردش انتخابی از حساب بانکی فعال نیست");
 if(!bankIdentityMatches(line,treasury))throw new Error("بانک یا حساب انتخاب‌شده با صورت‌حساب یکسان نیست");
 if(getTreasurySignedAmount(treasury)!==Number(line.signedAmount))throw new Error("مبلغ یا جهت گردش بانکی یکسان نیست");
 if(matchedTreasuryIds.map(Number).includes(Number(treasury.id)))throw new Error("این گردش قبلاً با ردیف دیگری تطبیق داده شده است");
 return true;
}
if(typeof module!=="undefined"&&module.exports)module.exports={parseBankCsv,getTreasurySignedAmount,normalizeBankIdentity,bankIdentityMatches,findBankMatchCandidates,autoMatchBankLines,validateBankManualMatch};
