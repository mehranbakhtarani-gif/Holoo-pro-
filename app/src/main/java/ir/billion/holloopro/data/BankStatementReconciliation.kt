package ir.billion.holloopro.data

data class BankStatementReconciliationResult(
    val netMovementRial: Long?,
    val calculatedClosingBalanceRial: Long?,
    val differenceRial: Long?,
    val overflow: Boolean
)

object BankStatementReconciliation {
    fun calculate(
        openingBalanceRial: Long,
        signedMovementsRial: Iterable<Long>,
        statementClosingBalanceRial: Long
    ): BankStatementReconciliationResult {
        return try {
            var movements = 0L
            signedMovementsRial.forEach { movements = Math.addExact(movements, it) }
            val calculated = Math.addExact(openingBalanceRial, movements)
            val difference = Math.subtractExact(calculated, statementClosingBalanceRial)
            BankStatementReconciliationResult(movements, calculated, difference, false)
        } catch (_: ArithmeticException) {
            BankStatementReconciliationResult(null, null, null, true)
        }
    }
}
