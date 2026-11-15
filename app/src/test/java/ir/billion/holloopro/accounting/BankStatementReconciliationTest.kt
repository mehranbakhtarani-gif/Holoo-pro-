package ir.billion.holloopro.accounting

import ir.billion.holloopro.data.BankStatementReconciliation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BankStatementReconciliationTest {
    @Test fun calculatesExactClosingBalanceAndZeroDifference() {
        val result = BankStatementReconciliation.calculate(1_000L, listOf(250L, -100L, 50L), 1_200L)
        assertEquals(200L, result.netMovementRial)
        assertEquals(1_200L, result.calculatedClosingBalanceRial)
        assertEquals(0L, result.differenceRial)
        assertFalse(result.overflow)
    }

    @Test fun reportsNonZeroDifference() {
        val result = BankStatementReconciliation.calculate(1_000L, listOf(200L), 1_250L)
        assertEquals(-50L, result.differenceRial)
    }

    @Test fun detectsOverflowInMovementSumAndClosingBalance() {
        val movementOverflow = BankStatementReconciliation.calculate(0L, listOf(Long.MAX_VALUE, 1L), 0L)
        val closingOverflow = BankStatementReconciliation.calculate(Long.MAX_VALUE, listOf(1L), 0L)
        assertTrue(movementOverflow.overflow)
        assertTrue(closingOverflow.overflow)
        assertNull(movementOverflow.netMovementRial)
        assertNull(closingOverflow.calculatedClosingBalanceRial)
    }
}
