package ir.billion.holloopro.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "products", indices = [Index(value = ["sku"], unique = true)])
data class ProductEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val sku: String,
    val name: String,
    val groupName: String,
    val yarnType: String,
    val color: String,
    val denier: Int,
    val twisted: Boolean,
    val unit: String = "kg",
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

data class ProductWithStock(
    @androidx.room.Embedded val product: ProductEntity,
    val stockKg: Double
)

@Entity(tableName = "parties", indices = [Index(value = ["name"])])
data class PartyEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val kind: String,
    val phone: String = "",
    val address: String = "",
    val openingBalanceRial: Long = 0,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "invoices", indices = [Index(value = ["number"], unique = true)])
data class InvoiceEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val number: String,
    val kind: String,
    val partyId: Long,
    val dateEpoch: Long = System.currentTimeMillis(),
    val subtotalRial: Long,
    val discountRial: Long,
    val taxRial: Long,
    val totalRial: Long,
    val status: String = "POSTED",
    val note: String = ""
)

@Entity(tableName = "invoice_lines", indices = [Index(value = ["invoiceId"])])
data class InvoiceLineEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val invoiceId: Long,
    val productId: Long,
    val quantityKg: Double,
    val unitPriceRial: Long,
    val lineTotalRial: Long
)

@Entity(tableName = "stock_movements", indices = [Index(value = ["productId", "createdAt"])])
data class StockMovementEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val productId: Long,
    val quantityKg: Double,
    val kind: String,
    val referenceId: Long = 0,
    val note: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "party_ledger", indices = [Index(value = ["partyId", "createdAt"])])
data class PartyLedgerEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val partyId: Long,
    val debitRial: Long,
    val creditRial: Long,
    val description: String,
    val referenceId: Long = 0,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "accounts", indices = [Index(value = ["code"], unique = true)])
data class AccountEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val code: String,
    val title: String,
    val type: String
)

@Entity(tableName = "vouchers")
data class VoucherEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val number: String,
    val dateEpoch: Long = System.currentTimeMillis(),
    val description: String,
    val reference: String = ""
)

@Entity(tableName = "voucher_lines", indices = [Index(value = ["voucherId"])])
data class VoucherLineEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val voucherId: Long,
    val accountId: Long,
    val debitRial: Long,
    val creditRial: Long,
    val description: String = ""
)

@Entity(tableName = "import_orders", indices = [Index(value = ["containerCode"])])
data class ImportOrderEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val supplierId: Long,
    val currency: String,
    val fxRateToRial: Long,
    val containerCode: String,
    val orderedAt: Long,
    val shippedAt: Long = 0,
    val departedAt: Long = 0,
    val arrivedAt: Long = 0,
    val grossWeightKg: Double,
    val goodsAmountMinor: Long,
    val freightRial: Long,
    val customsRial: Long,
    val otherCostsRial: Long,
    val supplierDueAt: Long,
    val status: String = "ORDERED"
)
