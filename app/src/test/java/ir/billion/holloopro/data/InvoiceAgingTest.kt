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
}
