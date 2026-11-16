package ir.billion.holloopro.data

object OperationClock {
    @Volatile private var manualEpochMillis: Long? = null

    fun setManualDate(epochMillis: Long?) {
        require(epochMillis == null || epochMillis > 0L) { "تاریخ دستی معتبر نیست" }
        manualEpochMillis = epochMillis
    }

    fun now(): Long = manualEpochMillis ?: System.currentTimeMillis()

    fun isManual(): Boolean = manualEpochMillis != null
}
