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

    @Test fun indistinguishableBlankRowsAreNotDiscardedAsDuplicates() {
        val seen = mutableSetOf<BankStatementDuplicateKey>()
        val first = BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, 500L))
        val repeated = BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, 500L))
        assertFalse(first.hasReliableIdentity)
        assertFalse(repeated.hasReliableIdentity)
        // Equal date/amount with no reference or description can be two real transactions.
        assertTrue(seen.add(first))
        assertTrue(seen.add(repeated))
    }

    @Test fun rowsWithAReferenceOrDescriptionCanBeDeduplicated() {
        val seen = mutableSetOf<BankStatementDuplicateKey>()
        val first = BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, 500L, "R-1", ""))
        val repeated = BankStatementDuplicateKey.from("Bank A", BankStatementCsvRow(100L, 500L, "R-1", ""))
        assertTrue(first.hasReliableIdentity)
        assertTrue(seen.add(first))
        assertFalse(seen.add(repeated))
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
