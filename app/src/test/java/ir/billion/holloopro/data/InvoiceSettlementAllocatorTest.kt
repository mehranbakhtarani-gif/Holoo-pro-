package ir.billion.holloopro.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class InvoiceSettlementAllocatorTest {
    private val saleA = InvoiceSettlementCapacity(1L, 7L, "SALE", "POSTED", 600L)
    private val saleB = InvoiceSettlementCapacity(2L, 7L, "SALE", "POSTED", 500L)

    @Test fun allocatesOneReceiptAcrossMultipleInvoices() {
        val total = InvoiceSettlementAllocator.validate("RECEIPT", 7L, 1_000L, 100L, listOf(saleA, saleB), listOf(InvoiceSettlementAllocationInput(1L, 400L), InvoiceSettlementAllocationInput(2L, 500L)))
        assertEquals(900L, total)
    }

    @Test fun allowsPartialAllocationAcrossInvoices() {
        val total = InvoiceSettlementAllocator.validate("RECEIPT", 7L, 1_000L, 0L, listOf(saleA, saleB), listOf(InvoiceSettlementAllocationInput(1L, 200L), InvoiceSettlementAllocationInput(2L, 100L)))
        assertEquals(300L, total)
    }

    @Test fun rejectsAllocationAboveTreasuryRemaining() {
        assertThrows(IllegalArgumentException::class.java) { InvoiceSettlementAllocator.validate("RECEIPT", 7L, 500L, 100L, listOf(saleA, saleB), listOf(InvoiceSettlementAllocationInput(1L, 300L), InvoiceSettlementAllocationInput(2L, 200L))) }
    }

    @Test fun rejectsAllocationAboveAnyInvoiceBalance() {
        assertThrows(IllegalArgumentException::class.java) { InvoiceSettlementAllocator.validate("RECEIPT", 7L, 1_000L, 0L, listOf(saleA, saleB), listOf(InvoiceSettlementAllocationInput(1L, 601L))) }
    }

    @Test fun rejectsDifferentPartyAndWrongInvoiceKind() {
        assertThrows(IllegalArgumentException::class.java) { InvoiceSettlementAllocator.validate("RECEIPT", 7L, 1_000L, 0L, listOf(saleA, saleB.copy(invoiceId = 3L, partyId = 8L)), listOf(InvoiceSettlementAllocationInput(3L, 100L))) }
        assertThrows(IllegalArgumentException::class.java) { InvoiceSettlementAllocator.validate("RECEIPT", 7L, 1_000L, 0L, listOf(saleA.copy(invoiceKind = "PURCHASE")), listOf(InvoiceSettlementAllocationInput(1L, 100L))) }
    }

    @Test fun rejectsDuplicateInvoiceRowsAndNonPostedInvoices() {
        assertThrows(IllegalArgumentException::class.java) { InvoiceSettlementAllocator.validate("RECEIPT", 7L, 1_000L, 0L, listOf(saleA), listOf(InvoiceSettlementAllocationInput(1L, 100L), InvoiceSettlementAllocationInput(1L, 200L))) }
        assertThrows(IllegalArgumentException::class.java) { InvoiceSettlementAllocator.validate("RECEIPT", 7L, 1_000L, 0L, listOf(saleA.copy(status = "VOID")), listOf(InvoiceSettlementAllocationInput(1L, 100L))) }
    }

    @Test fun rejectsLongOverflowInsteadOfWrapping() {
        assertThrows(ArithmeticException::class.java) { InvoiceSettlementAllocator.validate("RECEIPT", 7L, Long.MAX_VALUE, 0L, listOf(saleA.copy(remainingRial = Long.MAX_VALUE), saleB.copy(remainingRial = Long.MAX_VALUE)), listOf(InvoiceSettlementAllocationInput(1L, Long.MAX_VALUE), InvoiceSettlementAllocationInput(2L, 1L))) }
    }
}
