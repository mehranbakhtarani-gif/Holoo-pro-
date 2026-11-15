package ir.billion.holloopro.accounting

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class AccountingEngineTest {
    @Test fun balancedVoucherIsAccepted() {
        val lines = listOf(
            VoucherLineDraft("1103", debitRial = 1_250_000),
            VoucherLineDraft("4101", creditRial = 1_250_000)
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
