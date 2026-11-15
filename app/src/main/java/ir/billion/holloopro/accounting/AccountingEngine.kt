package ir.billion.holloopro.accounting

import java.math.BigDecimal
import java.math.RoundingMode

data class VoucherLineDraft(
    val accountCode: String,
    val debitRial: Long = 0,
    val creditRial: Long = 0
)

object AccountingEngine {
    fun isBalanced(lines: List<VoucherLineDraft>): Boolean {
        if (lines.size < 2) return false
        if (lines.any { it.debitRial < 0 || it.creditRial < 0 }) return false
        if (lines.any { it.debitRial > 0 && it.creditRial > 0 }) return false
        val debit = lines.sumOf { it.debitRial }
        val credit = lines.sumOf { it.creditRial }
        return debit > 0 && debit == credit
    }

    fun requireBalanced(lines: List<VoucherLineDraft>) {
        require(isBalanced(lines)) { "سند حسابداری تراز نیست یا ردیف نامعتبر دارد" }
    }
}

object Money {
    fun rialToToman(rial: Long): BigDecimal =
        BigDecimal.valueOf(rial).divide(BigDecimal.TEN, 1, RoundingMode.HALF_UP)

    fun tomanToRial(toman: BigDecimal): Long =
        toman.multiply(BigDecimal.TEN).setScale(0, RoundingMode.HALF_UP).longValueExact()
}

object LandedCostCalculator {
    fun totalCostRial(
        goodsAmountMinor: Long,
        fxRateToRial: Long,
        freightRial: Long,
        customsRial: Long,
        otherCostsRial: Long
    ): Long {
        require(goodsAmountMinor >= 0 && fxRateToRial > 0)
        require(freightRial >= 0 && customsRial >= 0 && otherCostsRial >= 0)
        return Math.addExact(Math.multiplyExact(goodsAmountMinor, fxRateToRial),
            Math.addExact(freightRial, Math.addExact(customsRial, otherCostsRial)))
    }

    fun costPerKgRial(totalCostRial: Long, grossWeightKg: Double): Long {
        require(totalCostRial >= 0 && grossWeightKg > 0.0 && grossWeightKg.isFinite())
        return BigDecimal.valueOf(totalCostRial)
            .divide(BigDecimal.valueOf(grossWeightKg), 0, RoundingMode.HALF_UP)
            .longValueExact()
    }
}
