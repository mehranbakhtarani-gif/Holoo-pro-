package ir.billion.holloopro.data

import androidx.room.ColumnInfo
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
    val createdAt: Long = OperationClock.now()
)

data class ProductWithStock(
    @androidx.room.Embedded val product: ProductEntity,
    val stockKg: Double,
    val inventoryValueRial: Long = 0,
    val averageCostPerKgRial: Long = 0
)

@Entity(tableName = "parties", indices = [Index(value = ["name"])])
data class PartyEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val kind: String,
    val phone: String = "",
    val address: String = "",
    val openingBalanceRial: Long = 0,
    val createdAt: Long = OperationClock.now()
)

@Entity(tableName = "invoices", indices = [Index(value = ["number"], unique = true)])
data class InvoiceEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val number: String,
    val kind: String,
    val partyId: Long,
    val dateEpoch: Long = OperationClock.now(),
    val subtotalRial: Long,
    val discountRial: Long,
    val taxRial: Long,
    val totalRial: Long,
    val status: String = "POSTED",
    val note: String = "",
    @ColumnInfo(defaultValue = "0") val extraCostsRial: Long = 0,
    @ColumnInfo(defaultValue = "1") val warehouseId: Long = 1
)

data class InvoiceLineInput(val productId: Long, val quantityKg: Double, val unitPriceRial: Long)

@Entity(tableName = "invoice_lines", indices = [Index(value = ["invoiceId"])])
data class InvoiceLineEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val invoiceId: Long,
    val productId: Long,
    val quantityKg: Double,
    val unitPriceRial: Long,
    val lineTotalRial: Long,
    val inventoryCostRial: Long = 0
)

@Entity(tableName = "stock_movements", indices = [Index(value = ["productId", "createdAt"])])
data class StockMovementEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val productId: Long,
    val quantityKg: Double,
    val kind: String,
    val referenceId: Long = 0,
    val note: String = "",
    val createdAt: Long = OperationClock.now()
)

@Entity(tableName = "party_ledger", indices = [Index(value = ["partyId", "createdAt"])])
data class PartyLedgerEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val partyId: Long,
    val debitRial: Long,
    val creditRial: Long,
    val description: String,
    val referenceId: Long = 0,
    val createdAt: Long = OperationClock.now()
)

@Entity(tableName = "accounts", indices = [Index(value = ["code"], unique = true)])
data class AccountEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val code: String,
    val title: String,
    val type: String,
    val openingDebitRial: Long = 0,
    val openingCreditRial: Long = 0
)

@Entity(tableName = "vouchers")
data class VoucherEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val number: String,
    val dateEpoch: Long = OperationClock.now(),
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


data class ImportReceiptLineInput(val productId: Long, val quantityKg: Double)

@Entity(tableName = "import_receipts", indices = [Index(value = ["importOrderId"], unique = true)])
data class ImportReceiptEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val importOrderId: Long,
    val goodsCostRial: Long,
    val totalCostRial: Long,
    val receivedAt: Long = OperationClock.now()
)

@Entity(tableName = "import_receipt_lines", indices = [Index(value = ["receiptId"]), Index(value = ["productId"])])
data class ImportReceiptLineEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val receiptId: Long,
    val productId: Long,
    val quantityKg: Double,
    val allocatedCostRial: Long
)


@Entity(tableName = "product_valuations")
data class ProductValuationEntity(
    @androidx.room.PrimaryKey val productId: Long,
    val quantityKg: Double,
    val valueRial: Long,
    val updatedAt: Long = OperationClock.now()
)

@Entity(tableName = "treasury_entries", indices = [Index(value = ["partyId", "createdAt"])])
data class TreasuryEntryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val kind: String,
    val method: String,
    val partyId: Long,
    val amountRial: Long,
    val referenceNumber: String = "",
    val note: String = "",
    val createdAt: Long = OperationClock.now()
)


data class PartyBalanceRow(
    val partyId: Long,
    val partyName: String,
    val partyKind: String,
    val balanceRial: Long
)


data class AccountBalanceRow(
    val accountId: Long,
    val accountCode: String,
    val accountTitle: String,
    val accountType: String,
    val debitRial: Long,
    val creditRial: Long
)

data class AccountTrialBalanceRow(
    val accountId: Long,
    val accountCode: String,
    val accountTitle: String,
    val accountType: String,
    val openingDebitRial: Long,
    val openingCreditRial: Long,
    val debitTurnoverRial: Long,
    val creditTurnoverRial: Long,
    val endingDebitRial: Long,
    val endingCreditRial: Long
)

data class ProfitLossRow(val salesRial: Long, val costOfGoodsSoldRial: Long)

data class LedgerRow(val voucherNumber: String, val dateEpoch: Long, val voucherDescription: String, val reference: String, val accountCode: String, val accountTitle: String, val debitRial: Long, val creditRial: Long)

data class PartyLedgerRow(val id: Long, val partyId: Long, val debitRial: Long, val creditRial: Long, val description: String, val referenceId: Long, val createdAt: Long)


@Entity(tableName = "checks", indices = [Index(value = ["partyId", "dueDateEpoch"]), Index(value = ["checkNumber"], unique = true)])
data class CheckEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val checkNumber: String,
    val kind: String,
    val partyId: Long,
    val amountRial: Long,
    val issueDateEpoch: Long,
    val dueDateEpoch: Long,
    val bankName: String = "",
    val status: String = "OPEN",
    val note: String = "",
    val createdAt: Long = OperationClock.now()
)


@Entity(tableName = "invoice_settlements", indices = [Index(value = ["invoiceId"]), Index(value = ["treasuryEntryId"]), Index(value = ["treasuryEntryId", "invoiceId"], unique = true)])
data class InvoiceSettlementEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val invoiceId: Long,
    val treasuryEntryId: Long,
    val amountRial: Long,
    val createdAt: Long = OperationClock.now()
)

data class InvoiceAgingRow(
    val invoiceId: Long,
    val invoiceNumber: String,
    val kind: String,
    val partyId: Long,
    val partyName: String,
    val dateEpoch: Long,
    val totalRial: Long,
    val settledRial: Long,
    val returnedRial: Long,
    val outstandingRial: Long
)

data class InvoiceSettlementRow(val invoiceId: Long, val paidRial: Long)

data class TreasuryAllocationRow(val entryId: Long, val allocatedRial: Long)

data class InvoiceSettlementDetailRow(val settlementId: Long, val invoiceId: Long, val treasuryEntryId: Long, val amountRial: Long, val createdAt: Long, val entryKind: String, val method: String, val referenceNumber: String, val entryCreatedAt: Long)


@Entity(tableName = "invoice_returns", indices = [Index(value = ["invoiceId"]), Index(value = ["createdAt"])])
data class InvoiceReturnEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val invoiceId: Long,
    val amountRial: Long,
    val note: String = "",
    val createdAt: Long = OperationClock.now()
)

@Entity(tableName = "invoice_return_lines", indices = [Index(value = ["returnId"]), Index(value = ["invoiceLineId"])])
data class InvoiceReturnLineEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val returnId: Long,
    val invoiceLineId: Long,
    val quantityKg: Double,
    val refundAmountRial: Long,
    val inventoryCostRial: Long,
    @ColumnInfo(defaultValue = "0") val netSalesRial: Long = 0
)

data class ReturnableInvoiceLineRow(
    val invoiceId: Long,
    val invoiceLineId: Long,
    val productId: Long,
    val productName: String,
    val originalQuantityKg: Double,
    val returnedQuantityKg: Double,
    val unitPriceRial: Long,
    val lineTotalRial: Long,
    val inventoryCostRial: Long
)

data class InvoiceReturnSummaryRow(val invoiceId: Long, val returnedRial: Long)

data class InvoiceReturnLineInput(val invoiceLineId: Long, val quantityKg: Double)

data class ProductProfitRow(
    val productId: Long,
    val productName: String,
    val quantitySoldKg: Double,
    val salesRial: Long,
    val costRial: Long,
    val profitRial: Long
)

data class InvoiceProfitRow(
    val invoiceId: Long,
    val invoiceNumber: String,
    val partyId: Long,
    val partyName: String,
    val salesRial: Long,
    val costRial: Long,
    val profitRial: Long
)

@Entity(tableName = "warehouses", indices = [Index(value = ["name"], unique = true)])
data class WarehouseEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val address: String = "",
    val isDefault: Boolean = false,
    val createdAt: Long = OperationClock.now()
)

@Entity(tableName = "warehouse_stock_movements", indices = [Index(value = ["warehouseId", "productId", "createdAt"]), Index(value = ["productId"])])
data class WarehouseStockMovementEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val warehouseId: Long,
    val productId: Long,
    val quantityKg: Double,
    val kind: String,
    val referenceId: Long = 0,
    val note: String = "",
    val createdAt: Long = OperationClock.now()
)

@Entity(tableName = "warehouse_valuations", primaryKeys = ["warehouseId", "productId"], indices = [Index(value = ["productId"])])
data class WarehouseValuationEntity(
    val warehouseId: Long,
    val productId: Long,
    val quantityKg: Double,
    val valueRial: Long,
    val updatedAt: Long = OperationClock.now()
)

@Entity(
    tableName = "bank_statement_lines",
    indices = [Index(value = ["matchedTreasuryEntryId"], unique = true), Index(value = ["transactionDateEpoch"])]
)
data class BankStatementLineEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val bankName: String,
    val transactionDateEpoch: Long,
    // Positive = bank credit/deposit; negative = bank debit/withdrawal.
    val signedAmountRial: Long,
    val bankReference: String = "",
    val description: String = "",
    val matchedTreasuryEntryId: Long? = null,
    val matchedCheckId: Long? = null,
    val matchedVoucherId: Long? = null,
    val createdAt: Long = OperationClock.now()
)

@Entity(
    tableName = "bank_statement_periods",
    indices = [Index(value = ["bankName", "startDateEpoch", "endDateEpoch"], unique = true)]
)
data class BankStatementPeriodEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val bankName: String,
    val startDateEpoch: Long,
    val endDateEpoch: Long,
    val openingBalanceRial: Long,
    val closingBalanceRial: Long,
    val createdAt: Long = OperationClock.now()
)

data class WarehouseStockRow(
    val warehouseId: Long,
    val warehouseName: String,
    val productId: Long,
    val productName: String,
    val quantityKg: Double,
    val valueRial: Long,
    val averageCostPerKgRial: Long
)

data class WarehouseKardexRow(
    val id: Long,
    val warehouseId: Long,
    val warehouseName: String,
    val productName: String,
    val quantityKg: Double,
    val kind: String,
    val referenceId: Long,
    val note: String,
    val createdAt: Long
)
