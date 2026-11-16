package ir.billion.holloopro.data

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OperationClockTest {
    @After fun resetClock() { OperationClock.setManualDate(null) }

    @Test fun automaticModeUsesSystemClock() {
        OperationClock.setManualDate(null)
        val before = System.currentTimeMillis()
        val actual = OperationClock.now()
        val after = System.currentTimeMillis()
        assertTrue(actual in before..after)
        assertFalse(OperationClock.isManual())
    }

    @Test fun manualModeReturnsSelectedEpochForAllEntityDefaults() {
        val selected = 1_798_421_400_000L
        OperationClock.setManualDate(selected)
        assertEquals(selected, OperationClock.now())
        assertTrue(OperationClock.isManual())
    }

    @Test fun returningToAutomaticClearsManualOverride() {
        OperationClock.setManualDate(1_798_421_400_000L)
        OperationClock.setManualDate(null)
        assertFalse(OperationClock.isManual())
        val before = System.currentTimeMillis()
        val actual = OperationClock.now()
        val after = System.currentTimeMillis()
        assertTrue(actual in before..after)
    }

    @Test fun rejectsInvalidManualDates() {
        try {
            OperationClock.setManualDate(0L)
            throw AssertionError("Expected invalid date to be rejected")
        } catch (_: IllegalArgumentException) {
            assertFalse(OperationClock.isManual())
        }
    }
}
