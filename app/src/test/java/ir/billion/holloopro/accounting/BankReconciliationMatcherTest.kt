package ir.billion.holloopro.accounting

import ir.billion.holloopro.data.BankMatchCandidate
import ir.billion.holloopro.data.BankReconciliationMatcher
import ir.billion.holloopro.data.BankStatementLineEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BankReconciliationMatcherTest {
    private val baseDate = 1_760_000_000_000L

    @Test fun exactReferenceRanksAboveOtherSameAmountCandidates() {
        val statement = BankStatementLineEntity(
            bankName = "بانک",
            transactionDateEpoch = baseDate,
            signedAmountRial = 5_000_000,
            bankReference = "۱۲۳۴۵۶"
        )
        val suggestions = BankReconciliationMatcher.suggest(
            statement,
            listOf(
                BankMatchCandidate(1, "بدون مرجع", 5_000_000, dateEpoch = baseDate),
                BankMatchCandidate(2, "مرجع دقیق", 5_000_000, reference = "123456", dateEpoch = baseDate)
            )
        )
        assertEquals(2L, suggestions.first().candidate.id)
        assertTrue(suggestions.first().score > suggestions.last().score)
    }

    @Test fun oppositeDirectionAndDifferentAmountAreNeverSuggested() {
        val statement = BankStatementLineEntity(
            bankName = "بانک",
            transactionDateEpoch = baseDate,
            signedAmountRial = -2_000_000
        )
        val suggestions = BankReconciliationMatcher.suggest(
            statement,
            listOf(
                BankMatchCandidate(1, "واریز", 2_000_000, dateEpoch = baseDate),
                BankMatchCandidate(2, "مبلغ متفاوت", -2_100_000, dateEpoch = baseDate)
            )
        )
        assertTrue(suggestions.isEmpty())
    }

    @Test fun distantCandidateNeedsAnExactReferenceMatch() {
        val statement = BankStatementLineEntity(
            bankName = "بانک",
            transactionDateEpoch = baseDate,
            signedAmountRial = 900_000,
            bankReference = "AB-998877"
        )
        val suggestions = BankReconciliationMatcher.suggest(
            statement,
            listOf(
                BankMatchCandidate(1, "مرجع یکسان", 900_000, reference = "ab998877", dateEpoch = baseDate + 30L * 86_400_000L),
                BankMatchCandidate(2, "بدون مرجع", 900_000, dateEpoch = baseDate + 30L * 86_400_000L)
            )
        )
        assertEquals(listOf(1L), suggestions.map { it.candidate.id })
    }
}
