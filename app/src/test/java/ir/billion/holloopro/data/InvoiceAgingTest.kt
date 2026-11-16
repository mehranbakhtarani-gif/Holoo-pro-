package ir.billion.holloopro.data

import org.junit.Assert.assertEquals
import org.junit.Test

class InvoiceAgingTest {
    private val day = 86_400_000L

    @Test fun ageDaysUsesWholeDaysAndTreatsFutureDatedInvoicesAsCurrent() {
        val now = 2_000_000_000_000L
        assertEquals(0L, InvoiceAging.ageDays(now, now + day))
        assertEquals(0L, InvoiceAging.ageDays(now, now - day + 1L))
        assertEquals(1L, InvoiceAging.ageDays(now, now - day))
        assertEquals(30L, InvoiceAging.ageDays(now, now - 30L * day))
        assertEquals(Long.MAX_VALUE, InvoiceAging.ageDays(now, Long.MIN_VALUE))
    }

    @Test fun bucketBoundariesAreInclusiveAndHaveNoGapsOrOverlaps() {
        assertEquals(0, InvoiceAging.bucket(0L))
        assertEquals(0, InvoiceAging.bucket(30L))
        assertEquals(1, InvoiceAging.bucket(31L))
        assertEquals(1, InvoiceAging.bucket(60L))
        assertEquals(2, InvoiceAging.bucket(61L))
        assertEquals(2, InvoiceAging.bucket(90L))
        assertEquals(3, InvoiceAging.bucket(91L))
        assertEquals(3, InvoiceAging.bucket(Long.MAX_VALUE))
    }
    @Test fun sumsReceivablesAndPayablesSafely() {
        val rows = listOf(
            InvoiceAgingRow(1L, "S-1", "SALE", 1L, "Customer", 1L, 100L, 0L, 0L, 100L),
            InvoiceAgingRow(2L, "P-1", "PURCHASE", 2L, "Supplier", 1L, 200L, 0L, 0L, 200L),
            InvoiceAgingRow(3L, "S-2", "SALE", 1L, "Customer", 1L, 300L, 0L, 0L, 300L)
        )
        assertEquals(400L, InvoiceAging.sumOutstanding(rows, "SALE"))
        assertEquals(200L, InvoiceAging.sumOutstanding(rows, "PURCHASE"))
    }

    @Test fun returnsNullInsteadOfWrappingWhenAgingTotalsOverflow() {
        val rows = listOf(
            InvoiceAgingRow(1L, "S-1", "SALE", 1L, "Customer", 1L, Long.MAX_VALUE, 0L, 0L, Long.MAX_VALUE),
            InvoiceAgingRow(2L, "S-2", "SALE", 1L, "Customer", 1L, 1L, 0L, 0L, 1L)
        )
        assertEquals(null, InvoiceAging.sumOutstanding(rows, "SALE"))
    }

}
