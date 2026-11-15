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
