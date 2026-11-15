package ir.billion.holloopro.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import ir.billion.holloopro.data.AccountingRepository
import ir.billion.holloopro.data.AccountBalanceRow
import ir.billion.holloopro.data.ImportOrderEntity
import ir.billion.holloopro.data.InvoiceEntity
import ir.billion.holloopro.data.InvoiceLineInput
import ir.billion.holloopro.data.ImportReceiptLineInput
import ir.billion.holloopro.data.PartyEntity
import ir.billion.holloopro.data.ProductWithStock
import ir.billion.holloopro.data.TreasuryEntryEntity
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class AppViewModel(private val repository: AccountingRepository) : ViewModel() {
    val products: StateFlow<List<ProductWithStock>> =
        repository.products.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val parties: StateFlow<List<PartyEntity>> =
        repository.parties.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val partyBalances = repository.partyBalances.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val invoices: StateFlow<List<InvoiceEntity>> =
        repository.invoices.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val treasury: StateFlow<List<TreasuryEntryEntity>> =
        repository.treasury.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val accountBalances: StateFlow<List<AccountBalanceRow>> =
        repository.accountBalances.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
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

    fun saveProduct(id: Long?, sku: String, name: String, group: String, yarnType: String, color: String, denier: Int, twisted: Boolean, notes: String) =
        execute {
            if (id == null) repository.addProduct(sku, name, group, yarnType, color, denier, twisted, notes)
            else repository.updateProduct(id, sku, name, group, yarnType, color, denier, twisted, notes)
            if (id == null) "کالا ثبت شد" else "تغییرات کالا ذخیره شد"
        }

    fun deleteProduct(id: Long) = execute { repository.deleteProduct(id); "کالا حذف شد" }

    fun setOpeningInventoryValuation(productId: Long, costPerKgRial: Long) = execute {
        repository.setOpeningInventoryValuation(productId, costPerKgRial)
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

    fun createMultiLineInvoice(kind: String, partyId: Long, lines: List<InvoiceLineInput>, discount: Long, tax: Long) =
        execute { repository.createAndPostMultiLineInvoice(kind, partyId, lines, discount, tax); "فاکتور چندردیفی ثبت و سند حسابداری صادر شد" }

    fun reverseInvoice(id: Long) = execute { repository.reverseInvoice(id); "فاکتور برگشت شد" }

    fun addTreasury(kind: String, method: String, partyId: Long, amountRial: Long, reference: String, note: String) =
        execute { repository.addTreasuryEntry(kind, method, partyId, amountRial, reference, note); "دریافت/پرداخت و سند حسابداری ثبت شد" }

    fun addImport(
        supplierId: Long, currency: String, rate: Long, container: String, weight: Double,
        goods: Long, freight: Long, customs: Long, other: Long, creditDays: Int
    ) = execute {
        repository.addImportOrder(supplierId, currency, rate, container, weight, goods, freight, customs, other, creditDays)
        "سفارش واردات ثبت شد"
    }

    fun receiveImport(orderId: Long, lines: List<ImportReceiptLineInput>) = execute {
        repository.receiveImport(orderId, lines)
        "رسید انبار صادر شد؛ موجودی و سند بهای تمام‌شده ثبت شد"
    }

    private fun execute(block: suspend () -> String) {
        viewModelScope.launch {
            _message.value = null
            runCatching { block() }
                .onSuccess { _message.value = it }
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
