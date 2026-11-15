package ir.billion.holloopro.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import ir.billion.holloopro.data.AccountingRepository
import ir.billion.holloopro.data.ImportOrderEntity
import ir.billion.holloopro.data.InvoiceEntity
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
    val invoices: StateFlow<List<InvoiceEntity>> =
        repository.invoices.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val treasury: StateFlow<List<TreasuryEntryEntity>> =
        repository.treasury.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
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

    fun addProduct(sku: String, name: String, group: String, yarnType: String, color: String, denier: Int, twisted: Boolean, notes: String) =
        execute { repository.addProduct(sku, name, group, yarnType, color, denier, twisted, notes); "کالا ثبت شد" }

    fun deleteProduct(id: Long) = execute { repository.deleteProduct(id); "کالا حذف شد" }

    fun addParty(name: String, kind: String, phone: String, address: String, openingBalance: Long) =
        execute { repository.addParty(name, kind, phone, address, openingBalance); "شخص ثبت شد" }

    fun createInvoice(kind: String, partyId: Long, productId: Long, quantity: Double, price: Long, discount: Long, tax: Long) =
        execute { repository.createAndPostInvoice(kind, partyId, productId, quantity, price, discount, tax); "فاکتور ثبت و سند حسابداری صادر شد" }

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
