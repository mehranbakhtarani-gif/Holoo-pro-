package ir.billion.holloopro.data

data class BankStatementDuplicateKey(
    val bankName: String,
    val transactionDateEpoch: Long,
    val signedAmountRial: Long,
    val bankReference: String,
    val description: String
) {
    val hasReliableIdentity: Boolean
        get() = bankReference.isNotBlank() || description.isNotBlank()

    companion object {
        fun from(bankName: String, row: BankStatementCsvRow, defaultDescription: String = "") =
            BankStatementDuplicateKey(
                bankName = bankName.trim(),
                transactionDateEpoch = row.transactionDateEpoch,
                signedAmountRial = row.signedAmountRial,
                bankReference = row.bankReference.trim(),
                description = row.description.trim().ifBlank { defaultDescription }
            )
    }
}
