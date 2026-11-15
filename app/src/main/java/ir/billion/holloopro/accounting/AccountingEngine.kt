package ir.billion.holloopro.accounting

import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode

data class VoucherLineDraft(
    val accountCode: String,
    val debitRial: Long = 0,
    val creditRial: Long = 0
)


data class InventoryValuation(
    val quantityKg: Double,
    val valueRial: Long
)

data class InventoryIssue(
    val cogsRial: Long,
    val remaining: InventoryValuation
)

/**
 * Moving weighted-average valuation. Values are stored in whole Rial;
 * a full depletion consumes the exact remaining book value to avoid residue.
 */
object InventoryValuationEngine {
    fun receive(
        current: InventoryValuation,
        receivedKg: Double,
        receivedCostRial: Long
    ): InventoryValuation {
        require(current.quantityKg >= 0.0 && current.quantityKg.isFinite())
        require(current.valueRial >= 0)
        require(receivedKg > 0.0 && receivedKg.isFinite())
        require(receivedCostRial > 0)
        val newQuantity = current.quantityKg + receivedKg
        require(newQuantity.isFinite() && newQuantity > 0.0)
        return InventoryValuation(
            quantityKg = newQuantity,
            valueRial = Math.addExact(current.valueRial, receivedCostRial)
        )
    }

    fun issue(current: InventoryValuation, issuedKg: Double): InventoryIssue {
        require(current.quantityKg > 0.0 && current.quantityKg.isFinite())
        require(current.valueRial >= 0)
        require(issuedKg > 0.0 && issuedKg.isFinite())
        require(issuedKg <= current.quantityKg + 0.0000001) {
            "مقدار خروج از موجودی مقداری بیشتر است"
        }
        val fullIssue = issuedKg >= current.quantityKg - 0.0000001
        val cogs = if (fullIssue) current.valueRial else
            BigDecimal.valueOf(current.valueRial)
                .multiply(BigDecimal.valueOf(issuedKg))
                .divide(BigDecimal.valueOf(current.quantityKg), 0, RoundingMode.HALF_UP)
                .longValueExact()
        val remainingQuantity = if (fullIssue) 0.0 else current.quantityKg - issuedKg
        return InventoryIssue(
            cogsRial = cogs,
            remaining = InventoryValuation(
                quantityKg = remainingQuantity,
                valueRial = Math.subtractExact(current.valueRial, cogs)
            )
        )
    }

    fun averageCostPerKgRial(current: InventoryValuation): Long {
        require(current.quantityKg > 0.0 && current.quantityKg.isFinite())
        require(current.valueRial >= 0)
        return BigDecimal.valueOf(current.valueRial)
            .divide(BigDecimal.valueOf(current.quantityKg), 0, RoundingMode.HALF_UP)
            .longValueExact()
    }
}

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

    fun invoicePostingLines(
        kind: String,
        subtotalRial: Long,
        discountRial: Long,
        taxRial: Long
    ): List<VoucherLineDraft> {
        require(kind == "SALE" || kind == "PURCHASE")
        require(subtotalRial > 0 && discountRial >= 0 && discountRial < subtotalRial && taxRial >= 0)
        val netGoods = Math.subtractExact(subtotalRial, discountRial)
        val total = Math.addExact(netGoods, taxRial)
        require(total > 0)
        val lines = if (kind == "SALE") {
            buildList {
                add(VoucherLineDraft("1103", debitRial = total))
                add(VoucherLineDraft("4101", creditRial = netGoods))
                if (taxRial > 0) add(VoucherLineDraft("2103", creditRial = taxRial))
            }
        } else {
            // Until recoverable input-VAT treatment is configurable, retain tax in inventory cost.
            listOf(
                VoucherLineDraft("1301", debitRial = total),
                VoucherLineDraft("2101", creditRial = total)
            )
        }
        requireBalanced(lines)
        return lines
    }

    fun purchaseReversalAdjustment(
        actualInventoryCostRial: Long,
        originalInventoryDebitRial: Long
    ): List<VoucherLineDraft> {
        require(actualInventoryCostRial >= 0 && originalInventoryDebitRial >= 0)
        val difference = Math.subtractExact(actualInventoryCostRial, originalInventoryDebitRial)
        return when {
            difference > 0 -> listOf(
                VoucherLineDraft("1301", creditRial = difference),
                VoucherLineDraft("5202", debitRial = difference)
            )
            difference < 0 -> {
                val adjustment = Math.negateExact(difference)
                listOf(
                    VoucherLineDraft("1301", debitRial = adjustment),
                    VoucherLineDraft("5202", creditRial = adjustment)
                )
            }
            else -> emptyList()
        }
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
