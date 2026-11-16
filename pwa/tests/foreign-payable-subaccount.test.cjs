const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const app=fs.readFileSync(path.resolve(__dirname,"../app.js"),"utf8");

test("foreign payable form selects a specific bank or cash subaccount",()=>{
 assert.match(app,/\["accountCode","حساب صندوق \/ بانک","select",1\]/);
 assert.match(app,/fields\.foreignPayablePayments\.find\(x=>x\[0\]==="accountCode"\)\[4\]=accounts\.filter/);
 assert.match(app,/a\.type==="ASSET"&&\/\^110\[12\]\\d\*\$\//);
});

test("foreign payable payment uses selected subaccount for journal and treasury record",()=>{
 assert.match(app,/const method=accountCode\.startsWith\("1101"\)\?"صندوق":"بانک"/);
 assert.match(app,/const cashAccount=accountCode,journal=/);
 assert.match(app,/\{accountCode:cashAccount,debitRial:0,creditRial:plan\.settlementRial/);
 assert.match(app,/treasuryRecord=\{kind:"PAYMENT",method,accountCode,accountName:paymentAccount\.title/);
});

test("foreign payable payment and due dates use strict local calendar validation",()=>{
 assert.match(app,/dateValue=parseDateOnlyLocal\(d\.date,"تاریخ پرداخت ارزی"\)/);
 assert.match(app,/dueDate=d\.dueDate\?parseDateOnlyLocal\(d\.dueDate,"سررسید تعهد ارزی"\)/);
});

test("foreign payable reversal retains the original bank or cash subaccount",()=>{
 assert.match(app,/originalTreasury\.accountCode\|\|\(payment\.method==="بانک"\?"1102":"1101"\)/);
 assert.match(app,/accountCode:cashAccount,accountName:originalTreasury\.accountName\|\|cashAccount/);
});

test("allocation form enforces same party, matching currency and available settlement balance",()=>{
 assert.match(app,/tr\.partyId!==invoice\.partyId/);
 assert.match(app,/invoiceCurrency!==transactionCurrency/);
 assert.match(app,/validateTreasuryAllocation\(\{transaction:tr,invoice,amount,allocations:allocs/);
 assert.match(app,/await postVoucherAtomic\(\[\["treasury",tr\],\["invoices",invoice\],\["treasuryAllocations",allocation\]/);
 assert.match(app,/incrementAllocationVersion\(tr,"خزانه"\);\s*incrementAllocationVersion\(invoice,"فاکتور"\)/);
});
