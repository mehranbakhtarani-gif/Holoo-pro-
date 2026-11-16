package ir.billion.holloopro.data

data class InvoiceSettlementAllocationInput(val invoiceId: Long, val amountRial: Long)
data class InvoiceSettlementCapacity(val invoiceId: Long, val partyId: Long, val invoiceKind: String, val status: String, val remainingRial: Long)

/** Pure validation shared by the transactional repository operation and unit tests. */
object InvoiceSettlementAllocator {
    fun validate(
        treasuryKind: String,
        treasuryPartyId: Long,
        treasuryAmountRial: Long,
        alreadyAllocatedRial: Long,
        capacities: List<InvoiceSettlementCapacity>,
        requests: List<InvoiceSettlementAllocationInput>
    ): Long {
        require(treasuryKind == "RECEIPT" || treasuryKind == "PAYMENT") { "نوع سند خزانه معتبر نیست" }
        require(treasuryPartyId > 0L && treasuryAmountRial > 0L) { "مشخصات سند خزانه نامعتبر است" }
        require(alreadyAllocatedRial >= 0L && alreadyAllocatedRial <= treasuryAmountRial) { "جمع تخصیص‌های قبلی سند خزانه نامعتبر است" }
        require(requests.isNotEmpty()) { "حداقل یک فاکتور برای تخصیص انتخاب کنید" }
        require(requests.all { it.invoiceId > 0L && it.amountRial > 0L }) { "شناسه فاکتور و مبلغ تخصیص باید مثبت باشند" }
        require(requests.map { it.invoiceId }.distinct().size == requests.size) { "هر فاکتور را فقط یک‌بار در فهرست تخصیص وارد کنید" }
        require(capacities.map { it.invoiceId }.distinct().size == capacities.size) { "اطلاعات مانده فاکتورها تکراری است" }

        val capacityById = capacities.associateBy { it.invoiceId }
        var requestedTotal = 0L
        requests.forEach { request ->
            val invoice = capacityById[request.invoiceId] ?: throw IllegalArgumentException("فاکتور " + request.invoiceId + " پیدا نشد")
            require(invoice.status == "POSTED") { "فقط فاکتور ثبت‌شده قابل تسویه است" }
            require(invoice.partyId == treasuryPartyId) { "طرف حساب همه فاکتورها باید با سند خزانه یکسان باشد" }
            require((treasuryKind == "RECEIPT" && invoice.invoiceKind == "SALE") || (treasuryKind == "PAYMENT" && invoice.invoiceKind == "PURCHASE")) { "نوع دریافت/پرداخت با نوع فاکتور سازگار نیست" }
            require(invoice.remainingRial > 0L) { "فاکتور " + request.invoiceId + " مانده قابل تسویه ندارد" }
            require(request.amountRial <= invoice.remainingRial) { "مبلغ تخصیص به فاکتور " + request.invoiceId + " از مانده آن بیشتر است" }
            requestedTotal = Math.addExact(requestedTotal, request.amountRial)
        }
        val entryRemaining = Math.subtractExact(treasuryAmountRial, alreadyAllocatedRial)
        require(entryRemaining > 0L) { "مبلغ این رسید قبلاً کامل تخصیص یافته است" }
        require(requestedTotal <= entryRemaining) { "جمع تخصیص‌ها از مانده قابل تخصیص سند خزانه بیشتر است" }
        return requestedTotal
    }
}
