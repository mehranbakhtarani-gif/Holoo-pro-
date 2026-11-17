"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");
const inventory=require("../inventory-control.js");
function harness({countedQty=8,stale=false}={}){
 const db={
  stockAdjustments:[{id:1,kind:"STOCKTAKE",number:"STK-1",warehouseId:2,warehouseName:"Main",status:"OPEN",lineCount:1},{id:2,kind:"STOCKTAKE_LINE",stocktakeId:1,warehouseId:2,productId:3,productName:"FDY",expectedQty:10,expectedValue:1000,countedQty,status:"COUNTED"}],
  products:[{id:3,name:"FDY",stock:10,value:1000,avg:100}],
  warehouseStock:[{id:4,productId:3,warehouseId:2,stock:stale?11:10,value:1000,average:100}],
  inventoryLots:[{id:"LOT1",productId:3,warehouseId:2,remainingQty:10,remainingValue:1000,originalQty:10,originalCost:1000,status:"OPEN"}],
  accounts:[{id:"1301",type:"ASSET"},{id:"4201",type:"REVENUE"},{id:"5201",type:"EXPENSE"}]
 };
 let posted=null,put=null;
 const all=async store=>(db[store]||[]).map(x=>({...x}));
 const planLotSale=({quantity})=>({cogs:quantity*100,remainingStock:10-quantity,remainingValue:1000-quantity*100,average:100,newLots:[],updates:[{...db.inventoryLots[0],remainingQty:10-quantity,remainingValue:1000-quantity*100}]});
 const planLotReceipt=input=>({id:"LOT-NEW",productId:input.productId,warehouseId:input.warehouseId,remainingQty:input.quantity,remainingValue:input.totalCost});
 const ensureBaseAccounts=async()=>{};
 const postVoucherAtomic=async(entries,voucher,journal,guards)=>{posted={entries,voucher,journal,guards}};
 const putManyGuarded=async(entries,guards)=>{put={entries,guards}};
 const close=new Function("all","HolooInventoryControl","planLotSale","planLotReceipt","ensureBaseAccounts","postVoucherAtomic","putManyGuarded",app.slice(app.indexOf("async function closeStocktakePwa("),app.indexOf("async function receiveImportShipment",app.indexOf("async function closeStocktakePwa(")))+";return closeStocktakePwa;")(all,inventory,planLotSale,planLotReceipt,ensureBaseAccounts,postVoucherAtomic,putManyGuarded);
 return {db,close,get posted(){return posted},get put(){return put}};
}
test("stocktake close posts FIFO shortage, stock and exact 5201/1301 journal atomically",async()=>{
 const h=harness({countedQty:8});
 const result=await h.close(1);
 assert.equal(result.decreaseValue,200);assert.equal(result.increaseValue,0);
 const product=h.posted.entries.find(x=>x[0]==="products")[1];
 const stock=h.posted.entries.find(x=>x[0]==="warehouseStock")[1];
 const header=h.posted.entries.find(x=>x[0]==="stockAdjustments"&&x[1].kind==="STOCKTAKE")[1];
 assert.equal(product.stock,8);assert.equal(product.value,800);
 assert.equal(stock.stock,8);assert.equal(stock.value,800);
 assert.equal(header.status,"CLOSED");assert.equal(header.voucherNumber,"STKC-"+result.header.closedAt);
 assert.deepEqual(h.posted.journal.map(x=>[x.accountCode,x.debitRial,x.creditRial]),[["5201",200,0],["1301",0,200]]);
 assert.ok(h.posted.guards.some(x=>x.store==="warehouseStock"));
 assert.ok(h.posted.guards.some(x=>x.store==="inventoryLots"));
});
test("stocktake close posts surplus as 1301 debit and 4201 credit with a new FIFO lot",async()=>{
 const h=harness({countedQty:12});
 const result=await h.close(1);
 assert.equal(result.increaseValue,200);assert.equal(result.decreaseValue,0);
 assert.deepEqual(h.posted.journal.map(x=>[x.accountCode,x.debitRial,x.creditRial]),[["1301",200,0],["4201",0,200]]);
 assert.ok(h.posted.entries.some(x=>x[0]==="inventoryLots"&&x[1].id==="LOT-NEW"));
});
test("stocktake refuses close when the warehouse balance changed after counting",async()=>{
 const h=harness({countedQty:8,stale:true});
 await assert.rejects(h.close(1),/پس از شروع شمارش تغییر کرده است/);
 assert.equal(h.posted,null);assert.equal(h.put,null);
});
test("stocktake workflow is exposed in navigation and supports atomic close",()=>{
 const html=fs.readFileSync(path.resolve(__dirname,"../index.html"),"utf8");
 assert.match(app,/async function createStocktakePwa/);
 assert.match(app,/async function recordStocktakeCountPwa/);
 assert.match(app,/async function closeStocktakePwa/);
 assert.match(app,/data-stocktake-count/);
 assert.match(app,/data-stocktake-close/);
 assert.match(html,/data-page="stocktakes"/);
});
