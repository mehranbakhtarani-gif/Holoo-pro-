const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {convertForeignAmountToRial}=require("../foreign-currency.js");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("foreign currency conversion uses exact integer minor-unit arithmetic at large safe inputs",()=>{
 const result=convertForeignAmountToRial({currency:"USD",amountMinor:9007199254740991,fxRateRialPerUnit:28});
 assert.equal(result.rial,2522015791327477);
 assert.throws(()=>convertForeignAmountToRial({currency:"USD",amountMinor:Number.MAX_SAFE_INTEGER,fxRateRialPerUnit:Number.MAX_SAFE_INTEGER}));
});

test("realized foreign-exchange report excludes reversed invoice allocations",()=>{
 assert.match(app,/allocations\.filter\(x=>x\.status!=="REVERSED"&&\(Number\(x\.fxGainRial\|\|0\)>0\|\|Number\(x\.fxLossRial\|\|0\)>0\)\)/);
 assert.match(app,/foreignPayments\.filter\(x=>x\.status!=="REVERSED"\)/);
});

test("foreign payable payment reversal posts to the original selected cash or bank subaccount",()=>{
 assert.match(app,/originalTreasury\.accountCode\|\|\(payment\.method==="بانک"\?"1102":"1101"\)/);
 assert.match(app,/reversalTreasury=\{kind:"RECEIPT",method:payment\.method,accountCode:cashAccount,accountName:originalTreasury\.accountName\|\|cashAccount/);
});
