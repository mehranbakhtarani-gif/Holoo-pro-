package ir.billion.holloopro.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import ir.billion.holloopro.data.AccountingRepository
import ir.billion.holloopro.data.AccountBalanceRow
import ir.billion.holloopro.data.AccountTrialBalanceRow
import ir.billion.holloopro.data.LedgerRow
import ir.billion.holloopro.data.PartyLedgerRow
import ir.billion.holloopro.data.ImportOrderEntity
import ir.billion.holloopro.data.InvoiceEntity
import ir.billion.holloopro.data.ReturnableInvoiceLineRow
import ir.billion.holloopro.data.InvoiceReturnSummaryRow
import ir.billion.holloopro.data.InvoiceLineInput
import ir.billion.holloopro.data.InvoiceReturnLineInput
import ir.billion.holloopro.data.ImportReceiptLineInput
import ir.billion.holloopro.data.PartyEntity
import ir.billion.holloopro.data.ProductWithStock
import ir.billion.holloopro.data.WarehouseEntity
import ir.billion.holloopro.data.WarehouseStockRow
import ir.billion.holloopro.data.WarehouseKardexRow
import ir.billion.holloopro.data.ProductProfitRow
import ir.billion.holloopro.data.InvoiceProfitRow
import ir.billion.holloopro.data.TreasuryEntryEntity
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class AppViewModel(private val repository: AccountingRepository) : ViewModel() {
    val warehouses: StateFlow<List<WarehouseEntity>> = repository.warehouses.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val warehouseStocks: StateFlow<List<WarehouseStockRow>> = repository.warehouseStocks.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val warehouseKardex: StateFlow<List<WarehouseKardexRow>> = repository.warehouseKardex.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val products: StateFlow<List<ProductWithStock>> =
        repository.products.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val parties: StateFlow<List<PartyEntity>> =
        repository.parties.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val partyBalances = repository.partyBalances.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val invoices: StateFlow<List<InvoiceEntity>> =
        repository.invoices.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val returnableInvoiceLines = repository.returnableInvoiceLines.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val invoiceReturnTotals = repository.invoiceReturnTotals.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val invoiceSettlements = repository.invoiceSettlements.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val settlementDetails = repository.settlementDetails.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val treasuryAllocations = repository.treasuryAllocations.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val treasury: StateFlow<List<TreasuryEntryEntity>> =
        repository.treasury.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val accountBalances: StateFlow<List<AccountBalanceRow>> =
        repository.accountBalances.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val trialBalance: StateFlow<List<AccountTrialBalanceRow>> =
        repository.trialBalance.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val checks = repository.checks.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val ledger: StateFlow<List<LedgerRow>> =
        repository.ledger.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    fun partyLedger(partyId: Long) = repository.partyLedger(partyId)
    val productProfitability = repository.productProfitability.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList<ProductProfitRow>())
    val invoiceProfitability = repository.invoiceProfitability.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList<InvoiceProfitRow>())
    val profitLoss = repository.profitLoss.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ir.billion.holloopro.data.ProfitLossRow(0, 0))
    val imports: StateFlow<List<ImportOrderEntity>> =
        repository.imports.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val productCount = repository.productCount.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)
    val partyCount = repository.partyCount.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)
    val invoiceCount = repository.invoiceCount.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)
    val voucherCount = repository.voucherCount.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)
    val importCount = repository.importCount.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message

    fun clearMessage() { _message.value = null }

    fun loadDemoData() = execute { repository.loadDemoData(); "داده‌های آزمایشی شامل سه کالا، دو شخص، یک خرید و یک فروش ثبت شد" }

    fun saveProduct(id: Long?, sku: String, name: String, group: String, yarnType: String, color: String, denier: Int, twisted: Boolean, notes: String) =
        execute {
            if (id == null) repository.addProduct(sku, name, group, yarnType, color, denier, twisted, notes)
            else repository.updateProduct(id, sku, name, group, yarnType, color, denier, twisted, notes)
            if (id == null) "کالا ثبت شد" else "تغییرات کالا ذخیره شد"
        }

    fun adjustStock(productId: Long, deltaKg: Double, costPerKgRial: Long, warehouseId: Long = 1L) = execute {
        repository.adjustStock(productId, deltaKg, costPerKgRial, warehouseId)
        "اصلاح موجودی و سند حسابداری آن ثبت شد"
    }

    fun createWarehouse(name: String, address: String, onSuccess: () -> Unit) =
        execute(onSuccess) { repository.createWarehouse(name, address); "انبار جدید ثبت شد" }

    fun transferStock(productId: Long, sourceWarehouseId: Long, targetWarehouseId: Long, quantityKg: Double, onSuccess: () -> Unit) =
        execute(onSuccess) { repository.transferStock(productId, sourceWarehouseId, targetWarehouseId, quantityKg); "انتقال کالا بین انبارها ثبت شد" }

    fun deleteProduct(id: Long) = execute { repository.deleteProduct(id); "کالا حذف شد" }

    fun setOpeningInventoryValuation(productId: Long, costPerKgRial: Long, warehouseId: Long = 1L) = execute {
        repository.setOpeningInventoryValuation(productId, costPerKgRial, warehouseId)
        "بهای افتتاحیه موجودی ثبت شد"
    }

    fun saveParty(id: Long?, name: String, kind: String, phone: String, address: String, openingBalance: Long) =
        execute {
            if (id == null) repository.addParty(name, kind, phone, address, openingBalance)
            else repository.updateParty(id, name, kind, phone, address, openingBalance)
            if (id == null) "شخص ثبت شد" else "اطلاعات شخص ویرایش شد"
        }

    fun deleteParty(id: Long) = execute { repository.deleteParty(id); "شخص حذف شد" }

    fun createInvoice(kind: String, partyId: Long, productId: Long, quantity: Double, price: Long, discount: Long, tax: Long) =
        execute { repository.createAndPostInvoice(kind, partyId, productId, quantity, price, discount, tax); "فاکتور ثبت و سند حسابداری صادر شد" }

    fun createMultiLineInvoice(kind: String, partyId: Long, lines: List<InvoiceLineInput>, discount: Long, tax: Long, extraCosts: Long, warehouseId: Long, onSuccess: () -> Unit) =
        execute(onSuccess) { repository.createAndPostMultiLineInvoice(kind, partyId, lines, discount, tax, extraCosts, warehouseId); "فاکتور چندردیفی ثبت و سند حسابداری صادر شد" }

    fun reverseInvoice(id: Long) = execute { repository.reverseInvoice(id); "فاکتور برگشت شد" }

    fun createPartialInvoiceReturn(id: Long, lines: List<InvoiceReturnLineInput>, note: String, onSuccess: () -> Unit) =
        execute(onSuccess) { repository.createPartialInvoiceReturn(id, lines, note); "برگشت جزئی ثبت شد؛ موجودی و سند حسابداری اصلاح شدند" }

    fun saveAccount(code: String, title: String, type: String, onSuccess: () -> Unit) =
        execute(onSuccess) { repository.saveAccount(code, title, type); "کد حساب ذخیره شد" }

    fun updateOpeningBalances(values: Map<String, Pair<Long, Long>>) =
        execute { repository.updateOpeningBalances(values); "مانده افتتاحیه حساب‌ها ذخیره و تراز شد" }

    fun reverseManualVoucher(number: String) = execute { repository.reverseManualVoucher(number); "سند معکوس ثبت شد؛ سند اصلی حفظ شد" }

    fun addManualVoucher(description: String, lines: List<ir.billion.holloopro.accounting.VoucherLineDraft>, onSuccess: () -> Unit) =
        execute(onSuccess) { repository.addManualVoucher(description, lines); "سند دستی چندردیفی و متوازن ثبت شد" }

    fun allocateTreasuryToInvoice(entryId: Long, invoiceId: Long, amountRial: Long, onSuccess: () -> Unit = {}) =
        execute(onSuccess) { repository.allocateTreasuryToInvoice(entryId, invoiceId, amountRial); "پرداخت به فاکتور تخصیص یافت" }

    fun removeInvoiceSettlement(settlementId: Long, onSuccess: () -> Unit = {}) =
        execute(onSuccess) { repository.removeInvoiceSettlement(settlementId); "تخصیص لغو شد و مانده فاکتور و رسید به‌روزرسانی شد" }

    fun addTreasury(kind: String, method: String, partyId: Long, amountRial: Long, reference: String, note: String, onSuccess: () -> Unit) =
        execute(onSuccess) { repository.addTreasuryEntry(kind, method, partyId, amountRial, reference, note); "دریافت/پرداخت و سند حسابداری ثبت شد" }

    fun addCheck(number: String, kind: String, partyId: Long, amount: Long, issueAt: Long, dueAt: Long, bank: String, note: String, onSuccess: () -> Unit) = execute(onSuccess) { repository.addCheck(number, kind, partyId, amount, issueAt, dueAt, bank, note); "چک ثبت شد" }

    fun updateCheckStatus(id: Long, status: String) = execute { repository.updateCheckStatus(id, status); "وضعیت چک تغییر کرد" }

    fun addImport(
        supplierId: Long, currency: String, rate: Long, container: String, weight: Double,
        goods: Long, freight: Long, customs: Long, other: Long, creditDays: Int, onSuccess: () -> Unit
    ) = execute(onSuccess) {
        repository.addImportOrder(supplierId, currency, rate, container, weight, goods, freight, customs, other, creditDays)
        "سفارش واردات ثبت شد"
    }

    fun receiveImport(orderId: Long, lines: List<ImportReceiptLineInput>, onSuccess: () -> Unit) = execute(onSuccess) {
        repository.receiveImport(orderId, lines)
        "رسید انبار صادر شد؛ موجودی و سند بهای تمام‌شده ثبت شد"
    }

    private fun execute(onSuccess: () -> Unit = {}, block: suspend () -> String) {
        viewModelScope.launch {
            _message.value = null
            runCatching { block() }
                .onSuccess { _message.value = it; onSuccess() }
                .onFailure { _message.value = it.message ?: "خطای نامشخص" }
        }
    }

    class Factory(private val repository: AccountingRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(AppViewModel::class.java)) {
                return AppViewModel(repository) as T
            }
            error("Unknown ViewModel class")
        }
    }
}
