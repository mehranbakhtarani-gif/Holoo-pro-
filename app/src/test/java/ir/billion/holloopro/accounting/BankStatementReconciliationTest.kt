package ir.billion.holloopro.accounting

import ir.billion.holloopro.data.BankStatementReconciliation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BankStatementReconciliationTest {
    @Test fun calculatesClosingBalanceAndDifference() {
        val result = BankStatementReconciliation.calculate(1_000L, listOf(500L, -200L), 1_250L)
        assertFalse(result.overflow)
        assertEquals(300L, result.netMovementRial)
        assertEquals(1_300L, result.calculatedClosingBalanceRial)
        assertEquals(50L, result.differenceRial)
    }

    @Test fun detectsOverflowInMovementSumClosingBalanceAndDifference() {
        val movementOverflow = BankStatementReconciliation.calculate(0L, listOf(Long.MAX_VALUE, 1L), 0L)
        val closingOverflow = BankStatementReconciliation.calculate(Long.MAX_VALUE, listOf(1L), 0L)
        val differenceOverflow = BankStatementReconciliation.calculate(Long.MIN_VALUE, emptyList(), Long.MAX_VALUE)
        assertTrue(movementOverflow.overflow)
        assertTrue(closingOverflow.overflow)
        assertTrue(differenceOverflow.overflow)
        assertNull(movementOverflow.netMovementRial)
        assertNull(closingOverflow.calculatedClosingBalanceRial)
        assertNull(differenceOverflow.differenceRial)
    }
}
