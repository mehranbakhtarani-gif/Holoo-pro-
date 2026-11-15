package ir.billion.holloopro.accounting

import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode

data class VoucherLineDraft(
    val accountCode: String,
    val debitRial: Long = 0,
    val creditRial: Long = 0
)

object AccountingEngine {
    fun aggregateQuantities(lines: List<Pair<Long, Double>>): Map<Long, Double> {
        require(lines.isNotEmpty()) { "فاکتور باید حداقل یک ردیف داشته باشد" }
        require(lines.all { it.first > 0 && it.second > 0.0 && it.second.isFinite() }) {
            "مقدار هر ردیف باید مثبت و معتبر باشد"
        }
        return lines.groupBy({ it.first }, { it.second }).mapValues { (_, quantities) ->
            quantities.fold(0.0) { total, quantity ->
                val next = total + quantity
                require(next.isFinite()) { "مجموع مقدار کالا خارج از محدوده مجاز است" }
                next
            }
        }
    }

    fun allocateLandedCost(totalCostRial: Long, quantities: List<Pair<Long, Double>>): Map<Long, Long> {
        require(totalCostRial > 0)
        val aggregated = aggregateQuantities(quantities)
        val totalKg = aggregated.values.sum()
        require(totalKg.isFinite() && totalKg > 0.0)
        var allocated = 0L
        val entries = aggregated.entries.toList()
        return entries.mapIndexed { index, entry ->
            val amount = if (index == entries.lastIndex) Math.subtractExact(totalCostRial, allocated)
            else BigDecimal.valueOf(totalCostRial).multiply(BigDecimal.valueOf(entry.value))
                .divide(BigDecimal.valueOf(totalKg), 0, RoundingMode.HALF_UP)
                .longValueExact().also { allocated = Math.addExact(allocated, it) }
            entry.key to amount
        }.toMap()
    }

    fun isBalanced(lines: List<VoucherLineDraft>): Boolean {
        if (lines.size < 2) return false
        if (lines.any { it.debitRial < 0 || it.creditRial < 0 }) return false
        if (lines.any { it.debitRial > 0 && it.creditRial > 0 }) return false
        val debit = lines.fold(BigInteger.ZERO) { total, line -> total + BigInteger.valueOf(line.debitRial) }
        val credit = lines.fold(BigInteger.ZERO) { total, line -> total + BigInteger.valueOf(line.creditRial) }
        return debit.signum() > 0 && debit == credit
    }

    fun requireBalanced(lines: List<VoucherLineDraft>) {
        require(isBalanced(lines)) { "سند حسابداری تراز نیست یا ردیف نامعتبر دارد" }
    }

    fun treasuryVoucherLines(kind: String, method: String, amountRial: Long): List<VoucherLineDraft> {
        require(kind == "RECEIPT" || kind == "PAYMENT")
        require(method == "CASH" || method == "BANK")
        require(amountRial > 0)
        val cashOrBank = if (method == "CASH") "1101" else "1102"
        val lines = if (kind == "RECEIPT") {
            listOf(VoucherLineDraft(cashOrBank, debitRial = amountRial), VoucherLineDraft("1103", creditRial = amountRial))
        } else {
            listOf(VoucherLineDraft("2101", debitRial = amountRial), VoucherLineDraft(cashOrBank, creditRial = amountRial))
        }
        requireBalanced(lines)
        return lines
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
