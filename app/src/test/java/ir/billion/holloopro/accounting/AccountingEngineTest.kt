package ir.billion.holloopro.accounting

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class AccountingEngineTest {
    @Test fun duplicateInvoiceProductRowsAreAggregatedForStockValidation() {
        val requested = AccountingEngine.aggregateQuantities(
            listOf(1L to 4.25, 2L to 1.0, 1L to 3.75)
        )
        assertEquals(8.0, requested[1L]!!, 0.000001)
        assertEquals(1.0, requested[2L]!!, 0.000001)
    }

    @Test(expected = IllegalArgumentException::class)
    fun aggregatedStockQuantityRejectsOverflowToInfinity() {
        AccountingEngine.aggregateQuantities(
            listOf(1L to Double.MAX_VALUE, 1L to Double.MAX_VALUE)
        )
    }

    @Test fun balancedVoucherIsAccepted() {
        val lines = listOf(
            VoucherLineDraft("1103", debitRial = 1_250_000),
            VoucherLineDraft("4101", creditRial = 1_250_000)
        )
        assertTrue(AccountingEngine.isBalanced(lines))
    }

    @Test fun voucherBalanceCheckDoesNotOverflowLongTotals() {
        val lines = listOf(
            VoucherLineDraft("A", debitRial = Long.MAX_VALUE),
            VoucherLineDraft("B", debitRial = Long.MAX_VALUE),
            VoucherLineDraft("C", creditRial = Long.MAX_VALUE),
            VoucherLineDraft("D", creditRial = Long.MAX_VALUE)
        )
        assertTrue(AccountingEngine.isBalanced(lines))
    }

    @Test fun saleInvoiceTaxIsSeparatedFromRevenue() {
        val lines = AccountingEngine.invoicePostingLines("SALE", 1_000_000L, 100_000L, 90_000L)
        assertEquals(3, lines.size)
        assertEquals(990_000L, lines.first { it.accountCode == "1103" }.debitRial)
        assertEquals(900_000L, lines.first { it.accountCode == "4101" }.creditRial)
        assertEquals(90_000L, lines.first { it.accountCode == "2103" }.creditRial)
        assertTrue(AccountingEngine.isBalanced(lines))
    }

    @Test fun purchaseInvoiceTaxRemainsInInventoryCostUntilInputTaxPolicyIsConfigured() {
        val lines = AccountingEngine.invoicePostingLines("PURCHASE", 1_000_000L, 100_000L, 90_000L)
        assertEquals(2, lines.size)
        assertEquals(990_000L, lines.first { it.accountCode == "1301" }.debitRial)
        assertEquals(990_000L, lines.first { it.accountCode == "2101" }.creditRial)
        assertTrue(AccountingEngine.isBalanced(lines))
    }

    @Test fun purchaseAncillaryCostsAreCapitalizedIntoInventory() {
        val lines = AccountingEngine.invoicePostingLines("PURCHASE", 1_000L, 100L, 90L, 25L)
        assertEquals(1_015L, lines.first { it.accountCode == "1301" }.debitRial)
        assertEquals(1_015L, lines.first { it.accountCode == "2101" }.creditRial)
        assertTrue(AccountingEngine.isBalanced(lines))
    }

    @Test(expected = IllegalArgumentException::class)
    fun salesInvoiceCannotIncludePurchaseAncillaryCosts() {
        AccountingEngine.invoicePostingLines("SALE", 1_000L, 0L, 90L, 25L)
    }

    @Test fun invoicePostingWithoutTaxUsesTwoBalancedLines() {
        val sale = AccountingEngine.invoicePostingLines("SALE", 500_000L, 50_000L, 0L)
        val purchase = AccountingEngine.invoicePostingLines("PURCHASE", 500_000L, 50_000L, 0L)
        assertEquals(2, sale.size)
        assertEquals(2, purchase.size)
        assertTrue(AccountingEngine.isBalanced(sale))
        assertTrue(AccountingEngine.isBalanced(purchase))
    }

    @Test(expected = IllegalArgumentException::class)
    fun invoicePostingRejectsFullDiscount() {
        AccountingEngine.invoicePostingLines("SALE", 100L, 100L, 10L)
    }

    @Test fun purchaseReversalAdjustmentBalancesWhenActualCostIsHigher() {
        val lines = AccountingEngine.purchaseReversalAdjustment(1_250_000L, 1_000_000L)
        assertEquals(2, lines.size)
        assertEquals("1301", lines[0].accountCode)
        assertEquals(250_000L, lines[0].creditRial)
        assertEquals("5202", lines[1].accountCode)
        assertEquals(250_000L, lines[1].debitRial)
        assertTrue(AccountingEngine.isBalanced(lines))
    }

    @Test fun purchaseReversalAdjustmentBalancesWhenActualCostIsLower() {
        val lines = AccountingEngine.purchaseReversalAdjustment(750_000L, 1_000_000L)
        assertEquals(250_000L, lines[0].debitRial)
        assertEquals(250_000L, lines[1].creditRial)
        assertTrue(AccountingEngine.isBalanced(lines))
    }

    @Test fun purchaseReversalAdjustmentIsEmptyWhenCostsMatch() {
        assertTrue(AccountingEngine.purchaseReversalAdjustment(1_000_000L, 1_000_000L).isEmpty())
    }

    @Test fun purchaseReversalAdjustmentHandlesMaximumSupportedDifference() {
        val higher = AccountingEngine.purchaseReversalAdjustment(Long.MAX_VALUE, 0L)
        assertEquals(Long.MAX_VALUE, higher[0].creditRial)
        assertTrue(AccountingEngine.isBalanced(higher))

        val lower = AccountingEngine.purchaseReversalAdjustment(0L, Long.MAX_VALUE)
        assertEquals(Long.MAX_VALUE, lower[0].debitRial)
        assertTrue(AccountingEngine.isBalanced(lower))
    }

    @Test fun unbalancedVoucherIsRejected() {
        val lines = listOf(
            VoucherLineDraft("1103", debitRial = 1_250_000),
            VoucherLineDraft("4101", creditRial = 1_200_000)
        )
        assertFalse(AccountingEngine.isBalanced(lines))
    }

    @Test fun aLineCannotHaveBothDebitAndCredit() {
        assertFalse(AccountingEngine.isBalanced(listOf(
            VoucherLineDraft("1101", debitRial = 100, creditRial = 100),
            VoucherLineDraft("4101", creditRial = 100)
        )))
    }

    @Test fun rialAndTomanConversionIsExactToOneDecimal() {
        assertEquals(0, Money.rialToToman(12_345).compareTo(BigDecimal("1234.5")))
        assertEquals(12_350L, Money.tomanToRial(BigDecimal("1235")))
    }

    @Test fun receiptAndPaymentUseBalancedCashOrBankEntries() {
        val receipt = AccountingEngine.treasuryVoucherLines("RECEIPT", "CASH", 900_000)
        val payment = AccountingEngine.treasuryVoucherLines("PAYMENT", "BANK", 900_000)
        assertTrue(AccountingEngine.isBalanced(receipt))
        assertTrue(AccountingEngine.isBalanced(payment))
        assertEquals("1101", receipt.first().accountCode)
        assertEquals("2101", payment.first().accountCode)
    }

    @Test fun checkLifecyclePostingsAreBalancedForBothKinds() {
        for (kind in listOf("RECEIVED", "PAYABLE")) {
            for (event in listOf("ISSUE", "CLEARED", "RETURNED")) {
                assertTrue(AccountingEngine.isBalanced(AccountingEngine.checkVoucherLines(kind, event, 500_000L)))
            }
        }
        val receivedIssue = AccountingEngine.checkVoucherLines("RECEIVED", "ISSUE", 500_000L)
        assertEquals(500_000L, receivedIssue.first { it.accountCode == "1104" }.debitRial)
        assertEquals(500_000L, receivedIssue.first { it.accountCode == "1103" }.creditRial)
        val receivedClear = AccountingEngine.checkVoucherLines("RECEIVED", "CLEARED", 500_000L)
        assertEquals(500_000L, receivedClear.first { it.accountCode == "1102" }.debitRial)
        assertEquals(500_000L, receivedClear.first { it.accountCode == "1104" }.creditRial)
        val receivedReturn = AccountingEngine.checkVoucherLines("RECEIVED", "RETURNED", 500_000L)
        assertEquals(500_000L, receivedReturn.first { it.accountCode == "1103" }.debitRial)
        assertEquals(500_000L, receivedReturn.first { it.accountCode == "1104" }.creditRial)
        val payableIssue = AccountingEngine.checkVoucherLines("PAYABLE", "ISSUE", 500_000L)
        assertEquals(500_000L, payableIssue.first { it.accountCode == "2101" }.debitRial)
        assertEquals(500_000L, payableIssue.first { it.accountCode == "2104" }.creditRial)
    }

    @Test(expected = IllegalArgumentException::class)
    fun checkPostingRejectsUnknownEvent() {
        AccountingEngine.checkVoucherLines("RECEIVED", "UNKNOWN", 100L)
    }

    @Test fun landedCostAllocationIsProportionalAndSumsExactly() {
        val allocation = AccountingEngine.allocateLandedCost(
            totalCostRial = 10_000L,
            quantities = listOf(1L to 1.0, 2L to 2.0, 1L to 1.0)
        )
        assertEquals(2, allocation.size)
        assertEquals(5_000L, allocation[1L])
        assertEquals(5_000L, allocation[2L])
        assertEquals(10_000L, allocation.values.sum())
    }

    @Test fun landedCostAllocationAssignsRoundingRemainderWithoutLoss() {
        val allocation = AccountingEngine.allocateLandedCost(
            totalCostRial = 100L,
            quantities = listOf(1L to 1.0, 2L to 1.0, 3L to 1.0)
        )
        assertEquals(100L, allocation.values.sum())
        assertEquals(3, allocation.size)
    }

    @Test(expected = IllegalArgumentException::class)
    fun landedCostAllocationRejectsNonPositiveWeight() {
        AccountingEngine.allocateLandedCost(100L, listOf(1L to 0.0))
    }


    @Test fun weightedAverageReceiptCombinesOldAndNewInventoryValue() {
        val result = InventoryValuationEngine.receive(
            InventoryValuation(10.0, 1_000_000L), 10.0, 1_400_000L
        )
        assertEquals(20.0, result.quantityKg, 0.000001)
        assertEquals(2_400_000L, result.valueRial)
        assertEquals(120_000L, InventoryValuationEngine.averageCostPerKgRial(result))
    }

    @Test fun zeroCostReturnedInventoryCanBeReceivedWithoutInventingValue() {
        val result = InventoryValuationEngine.receive(InventoryValuation(2.0, 200L), 1.0, 0L)
        assertEquals(3.0, result.quantityKg, 0.000001)
        assertEquals(200L, result.valueRial)
    }

    @Test fun weightedAverageIssueReducesQuantityAndBookValueTogether() {
        val issue = InventoryValuationEngine.issue(
            InventoryValuation(20.0, 2_400_000L), 5.0
        )
        assertEquals(600_000L, issue.cogsRial)
        assertEquals(15.0, issue.remaining.quantityKg, 0.000001)
        assertEquals(1_800_000L, issue.remaining.valueRial)
    }

    @Test fun fullInventoryIssueConsumesAllRemainingRialWithoutRoundingResidue() {
        val issue = InventoryValuationEngine.issue(
            InventoryValuation(3.0, 100L), 3.0
        )
        assertEquals(100L, issue.cogsRial)
        assertEquals(0.0, issue.remaining.quantityKg, 0.0)
        assertEquals(0L, issue.remaining.valueRial)
    }

    @Test(expected = IllegalArgumentException::class)
    fun weightedAverageIssueRejectsQuantityAboveStock() {
        InventoryValuationEngine.issue(InventoryValuation(2.0, 200L), 2.1)
    }

    @Test(expected = ArithmeticException::class)
    fun weightedAverageReceiptRejectsRialOverflow() {
        InventoryValuationEngine.receive(
            InventoryValuation(1.0, Long.MAX_VALUE), 1.0, 1L
        )
    }

    @Test fun landedCostIncludesAllCostsAndCurrencyConversion() {
        val total = LandedCostCalculator.totalCostRial(
            goodsAmountMinor = 100,
            fxRateToRial = 500_000,
            freightRial = 2_000_000,
            customsRial = 1_000_000,
            otherCostsRial = 500_000
        )
        assertEquals(53_500_000L, total)
        assertEquals(535_000L, LandedCostCalculator.costPerKgRial(total, 100.0))
    }
}
