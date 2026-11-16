"use strict";
function safePlanAdd(a,b,label="جمع برنامه‌ریزی"){
 const value=a+b;if(!Number.isSafeInteger(value))throw new Error(label+" از محدوده عددی مجاز خارج است");return value;
}
function safePlanMultiply(a,b,label="ضرب برنامه‌ریزی"){
 const value=a*b;if(!Number.isSafeInteger(value))throw new Error(label+" از محدوده عددی مجاز خارج است");return value;
}
function exactPlanMinorToRial(amountMinor,rate,label="معادل ریالی"){
 const rial=(BigInt(amountMinor)*BigInt(rate)+50n)/100n;
 if(rial>BigInt(Number.MAX_SAFE_INTEGER))throw new Error(label+" از محدوده عددی مجاز خارج است");
 return Number(rial);
}
function planPercent(amount,basisPoints,label="درصد هزینه"){
 const result=(BigInt(amount)*BigInt(basisPoints)+5000n)/10000n;
 if(result>BigInt(Number.MAX_SAFE_INTEGER))throw new Error(label+" از محدوده عددی مجاز خارج است");
 return Number(result);
}
function calculateImportCapitalPlan(input){
 const count=Number(input.containerCount),goodsUsd=Number(input.goodsUsdPerContainer),grossKg=Number(input.grossKgPerContainer),fx=Number(input.fxRialPerUsd),advancePct=Number(input.advancePercent),otherCosts=Number(input.otherCostsRialPerContainer||0),upfrontPct=Number(input.otherCostsUpfrontPercent===undefined?100:input.otherCostsUpfrontPercent),capital=Number(input.availableCapitalRial||0),shippingDays=Number(input.shippingDays||0),creditDays=Number(input.creditDaysAfterReceipt||0),salePrice=Number(input.salePriceRialPerKg||0),sellThroughDays=Number(input.sellThroughDays||0),monthlyOperating=Number(input.monthlyOperatingCostRial||0);
 const required={containerCount:Number.isInteger(count)&&count>0&&count<=100,goodsUsdPerContainer:Number.isFinite(goodsUsd)&&goodsUsd>0&&Number.isSafeInteger(Math.round(goodsUsd*100))&&Math.abs(Math.round(goodsUsd*100)/100-goodsUsd)<1e-9,grossKgPerContainer:Number.isFinite(grossKg)&&grossKg>0,fxRialPerUsd:Number.isSafeInteger(fx)&&fx>0,advancePercent:Number.isFinite(advancePct)&&advancePct>=0&&advancePct<=100&&Math.abs(Math.round(advancePct*100)/100-advancePct)<1e-9,otherCostsRialPerContainer:Number.isSafeInteger(otherCosts)&&otherCosts>=0,otherCostsUpfrontPercent:Number.isFinite(upfrontPct)&&upfrontPct>=0&&upfrontPct<=100&&Math.abs(Math.round(upfrontPct*100)/100-upfrontPct)<1e-9,availableCapitalRial:Number.isSafeInteger(capital)&&capital>=0,shippingDays:Number.isInteger(shippingDays)&&shippingDays>=0&&shippingDays<=730,creditDaysAfterReceipt:Number.isInteger(creditDays)&&creditDays>=0&&creditDays<=730,salePriceRialPerKg:Number.isSafeInteger(salePrice)&&salePrice>=0,sellThroughDays:Number.isInteger(sellThroughDays)&&sellThroughDays>=0&&sellThroughDays<=3650,monthlyOperatingCostRial:Number.isSafeInteger(monthlyOperating)&&monthlyOperating>=0};
 const invalid=Object.keys(required).filter(k=>!required[k]);if(invalid.length)throw new Error("ورودی‌های برنامه‌ریزی واردات معتبر نیست: "+invalid.join("، "));
 const goodsUsdMinor=Math.round(goodsUsd*100),totalGoodsUsdMinor=safePlanMultiply(goodsUsdMinor,count,"جمع مبلغ ارزی کالا"),totalGoodsUsd=totalGoodsUsdMinor/100;
 const goodsRialPerContainer=exactPlanMinorToRial(goodsUsdMinor,fx,"بهای ریالی هر کانتینر"),landedCostPerContainer=safePlanAdd(goodsRialPerContainer,otherCosts,"بهای تمام‌شده هر کانتینر"),totalGoodsRial=safePlanMultiply(goodsRialPerContainer,count,"جمع بهای ریالی کالا"),totalOtherCosts=safePlanMultiply(otherCosts,count,"جمع هزینه‌های جانبی"),totalLandedCost=safePlanMultiply(landedCostPerContainer,count,"جمع بهای تمام‌شده"),totalWeightKg=grossKg*count;
 if(!Number.isFinite(totalWeightKg)||totalWeightKg<=0)throw new Error("وزن کل محموله از محدوده مجاز خارج است");
 const advanceBasisPoints=Math.round(advancePct*100),upfrontBasisPoints=Math.round(upfrontPct*100),supplierAdvancePerContainer=planPercent(goodsRialPerContainer,advanceBasisPoints,"پیش‌پرداخت تأمین‌کننده"),supplierBalancePerContainer=safePlanAdd(goodsRialPerContainer,-supplierAdvancePerContainer,"مانده تأمین‌کننده"),otherCostsUpfrontPerContainer=planPercent(otherCosts,upfrontBasisPoints,"هزینه‌های پیش‌پرداخت"),otherCostsLaterPerContainer=safePlanAdd(otherCosts,-otherCostsUpfrontPerContainer,"هزینه‌های معوق");
 const cashPerContainer=safePlanAdd(supplierAdvancePerContainer,otherCostsUpfrontPerContainer,"وجه نقد اولیه هر کانتینر"),cashNeededNow=safePlanMultiply(cashPerContainer,count,"وجه نقد موردنیاز"),futureSupplierPayable=safePlanMultiply(supplierBalancePerContainer,count,"مانده آتی تأمین‌کننده"),futureOtherCosts=safePlanMultiply(otherCostsLaterPerContainer,count,"هزینه‌های آتی"),cashGap=Math.max(0,cashNeededNow-capital),capitalSurplus=Math.max(0,capital-cashNeededNow);
 const landedCostPerKg=totalWeightKg>0?totalLandedCost/totalWeightKg:0,breakEvenPricePerKg=landedCostPerKg,revenue=salePrice>0?Math.round(salePrice*totalWeightKg):0;
 if(!Number.isSafeInteger(revenue))throw new Error("درآمد برآوردی از محدوده عددی مجاز خارج است");
 const grossProfit=salePrice>0?safePlanAdd(revenue,-totalLandedCost,"سود ناخالص برآوردی"):null,marginPercent=revenue>0?grossProfit/revenue*100:null;
 const dueDays=shippingDays+creditDays,monthlyRevenue=salePrice>0&&sellThroughDays>0?revenue/(sellThroughDays/30):null,monthlyNetAfterOperating=monthlyRevenue===null?null:monthlyRevenue-monthlyOperating;
 return {containerCount:count,goodsUsdPerContainer:goodsUsd,grossKgPerContainer:grossKg,fxRialPerUsd:fx,totalGoodsUsd,totalGoodsRial,totalOtherCosts,totalLandedCost,totalWeightKg,goodsRialPerContainer,landedCostPerContainer,landedCostPerKg,breakEvenPricePerKg,supplierAdvancePerContainer,supplierBalancePerContainer,otherCostsUpfrontPerContainer,otherCostsLaterPerContainer,cashNeededNow,futureSupplierPayable,futureOtherCosts,futurePayableDueDaysAfterOrder:dueDays,shippingDays,creditDaysAfterReceipt:creditDays,cashGap,capitalSurplus,availableCapitalRial:capital,revenue,grossProfit,marginPercent,monthlyRevenue,monthlyOperatingCostRial:monthlyOperating,monthlyNetAfterOperating,sellThroughDays};
}
function compareImportCapitalScenarios(input,counts=[1,2,4]){
 if(!Array.isArray(counts)||!counts.length||counts.some(n=>!Number.isInteger(n)||n<=0||n>100))throw new Error("تعداد سناریوها معتبر نیست");
 return counts.map(containerCount=>calculateImportCapitalPlan({...input,containerCount}));
}
if(typeof module!=="undefined"&&module.exports)module.exports={calculateImportCapitalPlan,compareImportCapitalScenarios};
