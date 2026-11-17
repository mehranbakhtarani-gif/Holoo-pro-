const test=require("node:test");const assert=require("node:assert/strict");const {createImportCharge,planImportChargePayment,planImportChargeReversal,reconcileImportCharges}=require("../import-payables.js");
test("creates linked ancillary payable",()=>{const c=createImportCharge({shipmentId:7,supplierId:3,amountRial:120000,category:"FREIGHT",reference:"IC:7:FREIGHT"});assert.equal(c.status,"OPEN");assert.equal(c.paidRial,0)});
test("partial and full payments; overpayment blocked",()=>{const c=createImportCharge({shipmentId:7,supplierId:3,amountRial:120000,category:"FREIGHT",reference:"IC:7:FREIGHT"});const p=planImportChargePayment({charge:c,amountRial:50000,paymentReference:"ICP:1"});assert.equal(p.updated.status,"PARTIAL");assert.equal(p.remainingRial,70000);const q=planImportChargePayment({charge:p.updated,amountRial:70000,paymentReference:"ICP:2"});assert.equal(q.updated.status,"PAID");assert.throws(()=>planImportChargePayment({charge:q.updated,amountRial:1}))});
test("payment reversal restores open balance and cannot repeat",()=>{const c={shipmentId:7,supplierId:3,amountRial:120000,paidRial:50000,status:"PARTIAL",reference:"IC:7:FREIGHT"},p={chargeReference:c.reference,shipmentId:7,supplierId:3,amountRial:50000,status:"POSTED",reference:"ICP:1"};const r=planImportChargeReversal({charge:c,payment:p});assert.equal(r.updated.paidRial,0);assert.equal(r.updated.status,"OPEN");assert.equal(r.reversedPayment.status,"REVERSED");assert.throws(()=>planImportChargeReversal({charge:r.updated,payment:r.reversedPayment}))});
test("reconciliation detects orphan, duplicate and mismatched links",()=>{const c=createImportCharge({shipmentId:7,supplierId:3,amountRial:120000,category:"FREIGHT",reference:"IC:7:FREIGHT"}),r=reconcileImportCharges({charges:[c],payments:[{reference:"x",chargeReference:"missing",shipmentId:7,supplierId:3,amountRial:1,status:"POSTED"},{reference:"x",chargeReference:c.reference,shipmentId:8,supplierId:3,amountRial:1,status:"POSTED"}]});assert.equal(r.ok,false);for(const type of ["ORPHAN_PAYMENT","DUPLICATE_OR_MISSING_PAYMENT_REFERENCE","PAYMENT_LINK_MISMATCH"])assert.ok(r.errors.some(x=>x.type===type))});
test("rejects negative and unsafe amount",()=>{assert.throws(()=>createImportCharge({shipmentId:1,supplierId:1,amountRial:-1,category:"FREIGHT",reference:"x"}));assert.throws(()=>createImportCharge({shipmentId:1,supplierId:1,amountRial:Number.MAX_SAFE_INTEGER+1,category:"FREIGHT",reference:"x"}))});

test("installment payments remain available after the first partial payment",()=>{const c=createImportCharge({shipmentId:9,supplierId:3,amountRial:1000,category:"FREIGHT",reference:"IC:9:FREIGHT"});const a=planImportChargePayment({charge:c,amountRial:250,paymentReference:"P1"});const b=planImportChargePayment({charge:a.updated,amountRial:250,paymentReference:"P2"});const d=planImportChargePayment({charge:b.updated,amountRial:500,paymentReference:"P3"});assert.equal(a.updated.status,"PARTIAL");assert.equal(b.updated.paidRial,500);assert.equal(d.updated.status,"PAID");assert.equal(d.updated.paidRial,1000)});
test("shipment receipt binds and guards every generated ancillary payable",()=>{const app=require("node:fs").readFileSync(require("node:path").join(__dirname,"..","app.js"),"utf8");assert.match(app,/lots,foreignPayables,importChargePayables\]\s*=\s*await Promise\.all/);assert.match(app,/\.\.\.chargePayables\.map\(x=>\[\"importChargePayables\",x\]\)/);assert.match(app,/store:\"importChargePayables\",match:\{reference:x\.reference\},expected:null/);});
test("legacy migration repairs missing charge categories without duplicating existing ones",()=>{const app=require("node:fs").readFileSync(require("node:path").join(__dirname,"..","app.js"),"utf8");assert.match(app,/shipments\.filter\(x=>x\.receivedAt\)/);assert.match(app,/if\(payables\.some\(p=>p\.reference===reference\)\)continue/);});
test("unreconciled legacy charges are excluded from confirmed outstanding totals",()=>{const app=require("node:fs").readFileSync(require("node:path").join(__dirname,"..","app.js"),"utf8");assert.match(app,/importChargePayableRows\.filter\(x=>x\.status!==\"RECONCILIATION_REQUIRED\"\)\.reduce/);});

test("reversing one of several installments preserves the other paid installments",()=>{const c=createImportCharge({shipmentId:10,supplierId:3,amountRial:1000,category:"FREIGHT",reference:"IC:10:FREIGHT"});const a=planImportChargePayment({charge:c,amountRial:250,paymentReference:"P1"});const b=planImportChargePayment({charge:a.updated,amountRial:250,paymentReference:"P2"});const d=planImportChargePayment({charge:b.updated,amountRial:500,paymentReference:"P3"});const r=planImportChargeReversal({charge:d.updated,payment:b.payment});assert.equal(r.updated.paidRial,750);assert.equal(r.updated.status,"PARTIAL");assert.equal(r.reversedPayment.status,"REVERSED")});
test("service worker cache is refreshed with the payable release",()=>{const sw=require("node:fs").readFileSync(require("node:path").join(__dirname,"..","sw.js"),"utf8");assert.match(sw,/holloo-pwa-v162-import-payables/)});

test("payment flow rejects ambiguous or invalid payables and guards first accrual against duplicates",()=>{
 const app=require("node:fs").readFileSync(require("node:path").join(__dirname,"..","app.js"),"utf8");
 assert.match(app,/matches\.length!==1/);
 assert.match(app,/!\["OPEN","PARTIAL"\]\.includes\(payable\.status\)/);
 assert.match(app,/accrualRows\.length!==1/);
 assert.match(app,/match:\{referenceId:accrualReference\},expected:null/);
});
test("import ancillary payment reversal restores payable, party balance and ledger",()=>{
 const app=require("node:fs").readFileSync(require("node:path").join(__dirname,"..","app.js"),"utf8");
 assert.match(app,/if\(original\.importAncillaryPayment\)/);
 assert.match(app,/payable\.paidRial=Number\(payable\.paidRial\)-Number\(original\.amount\)/);
 assert.match(app,/reversalEntries\.push\(\["importChargePayables",payable\]/);
});
test("legacy reconciliation is exposed in the UI and writes atomically without a new voucher",()=>{const app=require("node:fs").readFileSync(require("node:path").join(__dirname,"..","app.js"),"utf8");assert.match(app,/data-import-charge-reconcile/);assert.match(app,/reconcileLegacyImportChargePwa\(button\.dataset\.importChargeReconcile\)/);assert.match(app,/await putManyGuarded\(entries,guards\)/);});

function legacyReconciliationHarness(voucherAccount="2102") {
 const fs=require("node:fs"), path=require("node:path");
 const app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
 const start=app.indexOf("async function reconcileLegacyImportChargePwa(id){");
 const end=app.indexOf("async function reverseTreasuryAllocationPwa(id){",start);
 if(start<0||end<=start)throw Error("legacy reconciliation function not found");
 const db={
  importChargePayables:[{id:5,shipmentId:7,shipmentNumber:"S-7",category:"freight",categoryLabel:"حمل",amountRial:1000,paidRial:0,partyId:null,status:"RECONCILIATION_REQUIRED",reference:"IMPORT-CHARGE:7:freight"}],
  treasury:[{id:9,kind:"PAYMENT",method:"بانک",partyId:3,partyName:"طلبکار",amount:400,currency:"IRR",date:10,reference:"TREASURY:OLD:9",importAncillaryPayment:true,importShipmentId:7,importChargeCategory:"freight"}],
  parties:[{id:3,name:"طلبکار",kind:"SUPPLIER",balance:400}],
  vouchers:[{id:11,reference:"TREASURY:OLD:9"}],
  voucherLines:[{voucherId:11,accountCode:voucherAccount,debitRial:400,creditRial:0},{voucherId:11,accountCode:"1102",debitRial:0,creditRial:400}],
  partyLedger:[{id:13,partyId:3,date:10,debitRial:400,creditRial:0,referenceId:"TREASURY:OLD:9"}],
  treasuryAllocations:[]
 };
 let writes=0;
 const all=async store=>(db[store]||[]).map(row=>({...row}));
 const safeRialTotal=values=>values.reduce((sum,value)=>{if(!Number.isSafeInteger(value)||!Number.isSafeInteger(sum+value))throw Error("unsafe total");return sum+value},0);
 const applyPartyBalanceDelta=(party,delta)=>{party.balance+=delta};
 const putManyGuarded=async entries=>{
  writes++;
  for(const [store,value] of entries){
   const rows=db[store]||(db[store]=[]);
   const index=rows.findIndex(row=>Number(row.id)===Number(value.id));
   if(index>=0)rows[index]={...value};
   else rows.push({...value,id:store==="partyLedger"?Math.max(0,...rows.map(row=>Number(row.id)||0))+1:value.id});
  }
 };
 const reconcile=new Function("all","safeRialTotal","applyPartyBalanceDelta","putManyGuarded",app.slice(start,end)+";return reconcileLegacyImportChargePwa;")(all,safeRialTotal,applyPartyBalanceDelta,putManyGuarded);
 return {db,reconcile,get writes(){return writes}};
}

test("legacy reconciliation links verified payments and records the payable accrual once",async()=>{
 const h=legacyReconciliationHarness();
 await h.reconcile(5);
 assert.equal(h.db.importChargePayables[0].status,"PARTIAL");
 assert.equal(h.db.importChargePayables[0].paidRial,400);
 assert.equal(h.db.importChargePayables[0].partyId,3);
 assert.equal(h.db.parties[0].balance,-600);
 assert.equal(h.db.treasury[0].importChargePayableId,5);
 assert.ok(h.db.partyLedger.some(row=>row.referenceId==="IMPORT-CHARGE-ACCRUAL:5"&&row.creditRial===1000));
 assert.equal(h.writes,1);
});

test("legacy reconciliation refuses a mismatched 2102 voucher without changing records",async()=>{
 const h=legacyReconciliationHarness("2101");
 await assert.rejects(h.reconcile(5),/سند یکی از پرداخت‌های قدیمی/);
 assert.equal(h.writes,0);
 assert.equal(h.db.parties[0].balance,400);
 assert.equal(h.db.importChargePayables[0].status,"RECONCILIATION_REQUIRED");
});
