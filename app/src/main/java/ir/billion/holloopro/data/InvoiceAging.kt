package ir.billion.holloopro.data

object InvoiceAging {
    private const val DAY_MILLIS = 86_400_000L

    fun ageDays(nowEpoch: Long, invoiceDateEpoch: Long): Long =
        if (invoiceDateEpoch >= nowEpoch) 0L else runCatching {
            Math.subtractExact(nowEpoch, invoiceDateEpoch) / DAY_MILLIS
        }.getOrDefault(Long.MAX_VALUE)

    fun bucket(ageDays: Long): Int = when (ageDays) {
        in 0L..30L -> 0
        in 31L..60L -> 1
        in 61L..90L -> 2
        else -> 3
    }

    fun sumOutstanding(rows: Iterable<InvoiceAgingRow>, kind: String): Long? = try {
        rows.filter { it.kind == kind }.fold(0L) { total, row ->
            Math.addExact(total, row.outstandingRial)
        }
    } catch (_: ArithmeticException) {
        null
    }
}
