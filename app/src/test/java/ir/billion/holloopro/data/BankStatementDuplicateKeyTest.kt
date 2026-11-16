package ir.billion.holloopro.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BankStatementDuplicateKeyTest {
    @Test fun blankReferenceAndDescriptionStillProduceAStableDuplicateKey() {
        val first = BankStatementDuplicateKey.from("  Bank A  ", BankStatementCsvRow(100L, -500L, " ", ""))
        val second = BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, -500L))
        assertEquals(first, second)
    }

    @Test fun duplicateRowsWithinOneFileAreDetectedEvenWhenReferenceAndDescriptionAreBlank() {
        val seen = mutableSetOf<BankStatementDuplicateKey>()
        val first = BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, 500L))
        val repeated = BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, 500L))
        val differentAmount = BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, 501L))
        assertTrue(seen.add(first))
        assertFalse(seen.add(repeated))
        assertTrue(seen.add(differentAmount))
    }

    @Test fun referenceDescriptionDateAmountAndBankRemainPartOfTheKey() {
        val base = BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, -500L, "R1", "fee"))
        assertTrue(base != BankStatementDuplicateKey.from("Bank B", BankStatementCsvRow(100L, -500L, "R1", "fee")))
        assertTrue(base != BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(101L, -500L, "R1", "fee")))
        assertTrue(base != BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, -501L, "R1", "fee")))
        assertTrue(base != BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, -500L, "R2", "fee")))
        assertTrue(base != BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, -500L, "R1", "other")))
    }

    @Test fun blankBankFeeDescriptionUsesTheSameFallbackAsTheStoredStatementRow() {
        val key = BankStatementDuplicateKey.from(
            "Bank A",
            BankStatementCsvRow(100L, -500L, "", ""),
            defaultDescription = "کارمزد بانکی"
        )
        assertEquals("کارمزد بانکی", key.description)
    }
}
