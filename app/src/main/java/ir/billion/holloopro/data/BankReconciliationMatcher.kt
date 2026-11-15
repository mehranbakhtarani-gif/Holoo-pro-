package ir.billion.holloopro.data

import kotlin.math.abs

data class BankMatchCandidate(
    val id: Long,
    val title: String,
    val signedAmountRial: Long,
    val reference: String = "",
    val description: String = "",
    val dateEpoch: Long
)

data class BankMatchSuggestion(
    val candidate: BankMatchCandidate,
    val score: Int,
    val reasons: List<String>
)

object BankReconciliationMatcher {
    private const val DAY_MILLIS = 86_400_000L

    fun suggest(
        statement: BankStatementLineEntity,
        candidates: List<BankMatchCandidate>,
        maxDateDistanceDays: Long = 14L
    ): List<BankMatchSuggestion> {
        require(maxDateDistanceDays >= 0L)
        return candidates.mapNotNull { candidate ->
            if (candidate.signedAmountRial != statement.signedAmountRial) return@mapNotNull null

            val distanceDays = abs(candidate.dateEpoch - statement.transactionDateEpoch) / DAY_MILLIS
            val referenceScore = referenceScore(statement.bankReference, candidate.reference)
            if (distanceDays > maxDateDistanceDays && referenceScore == 0) return@mapNotNull null

            val dateScore = when {
                distanceDays <= 1L -> 30
                distanceDays <= 3L -> 25
                distanceDays <= 7L -> 18
                distanceDays <= maxDateDistanceDays -> 10
                else -> 0
            }
            val descriptionMatch = descriptionMatches(statement.description, candidate.description)
            val score = (50 + dateScore + referenceScore + if (descriptionMatch) 5 else 0).coerceAtMost(100)
            val reasons = buildList {
                add("مبلغ و جهت تراکنش دقیقاً برابر")
                add(if (distanceDays == 0L) "تاریخ یکسان" else "${distanceDays} روز اختلاف تاریخ")
                if (referenceScore >= 20) add("شماره مرجع یکسان")
                else if (referenceScore > 0) add("شماره مرجع مشابه")
                if (descriptionMatch) add("شرح تراکنش مشابه")
            }
            BankMatchSuggestion(candidate, score, reasons)
        }.sortedWith(compareByDescending<BankMatchSuggestion> { it.score }
            .thenBy { abs(it.candidate.dateEpoch - statement.transactionDateEpoch) })
    }

    private fun referenceScore(left: String, right: String): Int {
        val a = normalizeReference(left)
        val b = normalizeReference(right)
        if (a.isBlank() || b.isBlank()) return 0
        return when {
            a == b -> 20
            a.length >= 4 && b.length >= 4 && (a.contains(b) || b.contains(a)) -> 12
            else -> 0
        }
    }

    private fun descriptionMatches(left: String, right: String): Boolean {
        val a = normalizeWords(left)
        val b = normalizeWords(right)
        return a.isNotEmpty() && b.isNotEmpty() && a.intersect(b).isNotEmpty()
    }

    private fun normalizeReference(value: String): String = value
        .trim()
        .lowercase()
        .map { ch ->
            when (ch) {
                in '۰'..'۹' -> ('0'.code + ch.code - '۰'.code).toChar()
                in '٠'..'٩' -> ('0'.code + ch.code - '٠'.code).toChar()
                else -> ch
            }
        }
        .filter { it.isLetterOrDigit() }

    private fun normalizeWords(value: String): Set<String> = value
        .lowercase()
        .replace('ي', 'ی')
        .replace('ك', 'ک')
        .split(Regex("[^\\p{L}\\p{N}]+"))
        .filter { it.length >= 3 }
        .toSet()
}
