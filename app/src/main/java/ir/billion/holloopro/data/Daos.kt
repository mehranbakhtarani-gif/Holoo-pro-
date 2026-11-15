package ir.billion.holloopro.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ProductDao {
    @Query("SELECT p.*, COALESCE(SUM(sm.quantityKg), 0.0) AS stockKg, COALESCE(pv.valueRial, 0) AS inventoryValueRial, CASE WHEN COALESCE(pv.quantityKg, 0) > 0 THEN CAST(pv.valueRial / pv.quantityKg AS INTEGER) ELSE 0 END AS averageCostPerKgRial FROM products p LEFT JOIN stock_movements sm ON sm.productId = p.id LEFT JOIN product_valuations pv ON pv.productId = p.id GROUP BY p.id ORDER BY p.name")
    fun observeWithStock(): Flow<List<ProductWithStock>>

    @Query("SELECT * FROM products WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): ProductEntity?

    @Query("SELECT COUNT(*) FROM products WHERE sku LIKE :pattern")
    suspend fun countBySkuPattern(pattern: String): Int

    @Insert
    suspend fun insert(product: ProductEntity): Long

    @Update
    suspend fun update(product: ProductEntity)

    @Query("DELETE FROM products WHERE id = :id")
    suspend fun delete(id: Long)


    @Query("SELECT p.id AS productId, p.name AS productName, (COALESCE((SELECT SUM(il.quantityKg) FROM invoice_lines il INNER JOIN invoices i ON i.id = il.invoiceId WHERE il.productId = p.id AND i.kind = 'SALE' AND i.status = 'POSTED'), 0.0) - COALESCE((SELECT SUM(irl.quantityKg) FROM invoice_return_lines irl INNER JOIN invoice_lines il ON il.id = irl.invoiceLineId INNER JOIN invoices i ON i.id = il.invoiceId WHERE il.productId = p.id AND i.kind = 'SALE' AND i.status = 'POSTED'), 0.0)) AS quantitySoldKg, (COALESCE((SELECT SUM(il.lineTotalRial - CAST(ROUND(i.discountRial * il.lineTotalRial * 1.0 / i.subtotalRial) AS INTEGER)) FROM invoice_lines il INNER JOIN invoices i ON i.id = il.invoiceId WHERE il.productId = p.id AND i.kind = 'SALE' AND i.status = 'POSTED'), 0) - COALESCE((SELECT SUM(irl.netSalesRial) FROM invoice_return_lines irl INNER JOIN invoice_lines il ON il.id = irl.invoiceLineId INNER JOIN invoices i ON i.id = il.invoiceId WHERE il.productId = p.id AND i.kind = 'SALE' AND i.status = 'POSTED'), 0)) AS salesRial, (COALESCE((SELECT SUM(il.inventoryCostRial) FROM invoice_lines il INNER JOIN invoices i ON i.id = il.invoiceId WHERE il.productId = p.id AND i.kind = 'SALE' AND i.status = 'POSTED'), 0) - COALESCE((SELECT SUM(irl.inventoryCostRial) FROM invoice_return_lines irl INNER JOIN invoice_lines il ON il.id = irl.invoiceLineId INNER JOIN invoices i ON i.id = il.invoiceId WHERE il.productId = p.id AND i.kind = 'SALE' AND i.status = 'POSTED'), 0)) AS costRial, ((COALESCE((SELECT SUM(il.lineTotalRial - CAST(ROUND(i.discountRial * il.lineTotalRial * 1.0 / i.subtotalRial) AS INTEGER)) FROM invoice_lines il INNER JOIN invoices i ON i.id = il.invoiceId WHERE il.productId = p.id AND i.kind = 'SALE' AND i.status = 'POSTED'), 0) - COALESCE((SELECT SUM(irl.netSalesRial) FROM invoice_return_lines irl INNER JOIN invoice_lines il ON il.id = irl.invoiceLineId INNER JOIN invoices i ON i.id = il.invoiceId WHERE il.productId = p.id AND i.kind = 'SALE' AND i.status = 'POSTED'), 0)) - (COALESCE((SELECT SUM(il.inventoryCostRial) FROM invoice_lines il INNER JOIN invoices i ON i.id = il.invoiceId WHERE il.productId = p.id AND i.kind = 'SALE' AND i.status = 'POSTED'), 0) - COALESCE((SELECT SUM(irl.inventoryCostRial) FROM invoice_return_lines irl INNER JOIN invoice_lines il ON il.id = irl.invoiceLineId INNER JOIN invoices i ON i.id = il.invoiceId WHERE il.productId = p.id AND i.kind = 'SALE' AND i.status = 'POSTED'), 0))) AS profitRial FROM products p ORDER BY profitRial DESC, p.name")
    fun observeProfitability(): Flow<List<ProductProfitRow>>

    @Query("SELECT COUNT(*) FROM products")
    fun observeCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM invoice_lines WHERE productId = :id")
    suspend fun invoiceLineCount(id: Long): Int

    @Query("SELECT COUNT(*) FROM stock_movements WHERE productId = :id")
    suspend fun movementCount(id: Long): Int
}

@Dao
interface PartyDao {
    @Query("SELECT * FROM parties ORDER BY name")
    fun observeAll(): Flow<List<PartyEntity>>

    @Query("SELECT p.id AS partyId, p.name AS partyName, p.kind AS partyKind, p.openingBalanceRial + COALESCE(SUM(l.debitRial - l.creditRial), 0) AS balanceRial FROM parties p LEFT JOIN party_ledger l ON l.partyId = p.id GROUP BY p.id ORDER BY p.name")
    fun observeBalances(): Flow<List<PartyBalanceRow>>

    @Query("SELECT * FROM parties WHERE kind IN ('SUPPLIER','BOTH') ORDER BY name")
    fun observeSuppliers(): Flow<List<PartyEntity>>

    @Query("SELECT * FROM parties WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): PartyEntity?

    @Insert
    suspend fun insert(party: PartyEntity): Long

    @Update
    suspend fun update(party: PartyEntity)

    @Query("DELETE FROM parties WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("SELECT COUNT(*) FROM parties")
    fun observeCount(): Flow<Int>

    @Query("SELECT (SELECT COUNT(*) FROM invoices WHERE partyId = :id) + (SELECT COUNT(*) FROM treasury_entries WHERE partyId = :id) + (SELECT COUNT(*) FROM party_ledger WHERE partyId = :id) + (SELECT COUNT(*) FROM checks WHERE partyId = :id) + (SELECT COUNT(*) FROM import_orders WHERE supplierId = :id)")
    suspend fun linkedRecordCount(id: Long): Int
}

@Dao
interface InvoiceDao {
    @Query("SELECT * FROM invoices ORDER BY dateEpoch DESC, id DESC")
    fun observeAll(): Flow<List<InvoiceEntity>>

    @Query("SELECT * FROM invoices WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): InvoiceEntity?

    @Insert
    suspend fun insert(invoice: InvoiceEntity): Long

    @Update
    suspend fun update(invoice: InvoiceEntity)

    @Query("SELECT (COALESCE((SELECT SUM(subtotalRial - discountRial) FROM invoices WHERE kind = 'SALE' AND status = 'POSTED'), 0) - COALESCE((SELECT SUM(vl.debitRial - vl.creditRial) FROM voucher_lines vl INNER JOIN accounts a ON a.id = vl.accountId INNER JOIN vouchers v ON v.id = vl.voucherId WHERE a.code = '4101' AND v.reference LIKE 'INVOICE_RETURN:%'), 0)) AS salesRial, (COALESCE((SELECT SUM(il.inventoryCostRial) FROM invoice_lines il INNER JOIN invoices i ON i.id = il.invoiceId WHERE i.kind = 'SALE' AND i.status = 'POSTED'), 0) - COALESCE((SELECT SUM(vl.creditRial - vl.debitRial) FROM voucher_lines vl INNER JOIN accounts a ON a.id = vl.accountId INNER JOIN vouchers v ON v.id = vl.voucherId WHERE a.code = '5101' AND v.reference LIKE 'INVOICE_RETURN:%'), 0) + COALESCE((SELECT SUM(vl.debitRial - vl.creditRial) FROM voucher_lines vl INNER JOIN accounts a ON a.id = vl.accountId WHERE a.code = '5202'), 0)) AS costOfGoodsSoldRial")
    fun observeProfitLoss(): Flow<ProfitLossRow>


    @Query("SELECT i.id AS invoiceId, i.number AS invoiceNumber, i.partyId AS partyId, p.name AS partyName, (i.subtotalRial - i.discountRial - COALESCE((SELECT SUM(irl.netSalesRial) FROM invoice_return_lines irl INNER JOIN invoice_lines il ON il.id = irl.invoiceLineId WHERE il.invoiceId = i.id), 0)) AS salesRial, (COALESCE((SELECT SUM(il.inventoryCostRial) FROM invoice_lines il WHERE il.invoiceId = i.id), 0) - COALESCE((SELECT SUM(irl.inventoryCostRial) FROM invoice_return_lines irl INNER JOIN invoice_lines il ON il.id = irl.invoiceLineId WHERE il.invoiceId = i.id), 0)) AS costRial, ((i.subtotalRial - i.discountRial - COALESCE((SELECT SUM(irl.netSalesRial) FROM invoice_return_lines irl INNER JOIN invoice_lines il ON il.id = irl.invoiceLineId WHERE il.invoiceId = i.id), 0)) - (COALESCE((SELECT SUM(il.inventoryCostRial) FROM invoice_lines il WHERE il.invoiceId = i.id), 0) - COALESCE((SELECT SUM(irl.inventoryCostRial) FROM invoice_return_lines irl INNER JOIN invoice_lines il ON il.id = irl.invoiceLineId WHERE il.invoiceId = i.id), 0))) AS profitRial FROM invoices i INNER JOIN parties p ON p.id = i.partyId WHERE i.kind = 'SALE' AND i.status = 'POSTED' ORDER BY i.dateEpoch DESC, i.id DESC")
    fun observeInvoiceProfitability(): Flow<List<InvoiceProfitRow>>

    @Query("SELECT COUNT(*) FROM invoices")
    fun observeCount(): Flow<Int>

    @Query("SELECT i.id AS invoiceId, COALESCE(SUM(s.amountRial), 0) AS paidRial FROM invoices i LEFT JOIN invoice_settlements s ON s.invoiceId = i.id GROUP BY i.id")
    fun observeSettlementTotals(): Flow<List<InvoiceSettlementRow>>

    @Query("SELECT COALESCE(SUM(amountRial), 0) FROM invoice_settlements WHERE invoiceId = :invoiceId")
    suspend fun settledForInvoice(invoiceId: Long): Long
}

@Dao
interface InvoiceLineDao {
    @Query("SELECT * FROM invoice_lines WHERE invoiceId = :invoiceId")
    suspend fun byInvoice(invoiceId: Long): List<InvoiceLineEntity>

    @Insert
    suspend fun insertAll(lines: List<InvoiceLineEntity>)
}

@Dao
interface ProductValuationDao {
    @Query("SELECT * FROM product_valuations WHERE productId = :productId LIMIT 1")
    suspend fun get(productId: Long): ProductValuationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(valuation: ProductValuationEntity)
}

@Dao
interface StockDao {
    @Query("SELECT COALESCE(SUM(quantityKg), 0.0) FROM stock_movements WHERE productId = :productId")
    suspend fun stockForProduct(productId: Long): Double

    @Insert
    suspend fun insert(movement: StockMovementEntity)
}

@Dao
interface PartyLedgerDao {
    @Insert
    suspend fun insert(entry: PartyLedgerEntity)

    @Query("SELECT COALESCE(SUM(debitRial - creditRial), 0) + (SELECT openingBalanceRial FROM parties WHERE id = :partyId) FROM party_ledger WHERE partyId = :partyId")
    suspend fun balanceRial(partyId: Long): Long

    @Query("SELECT id, partyId, debitRial, creditRial, description, referenceId, createdAt FROM party_ledger WHERE partyId = :partyId ORDER BY createdAt DESC, id DESC")
    fun observeForParty(partyId: Long): Flow<List<PartyLedgerRow>>
}

@Dao
interface AccountDao {
    @Query("SELECT a.id AS accountId, a.code AS accountCode, a.title AS accountTitle, a.type AS accountType, CASE WHEN (a.openingDebitRial + COALESCE(SUM(vl.debitRial), 0)) > (a.openingCreditRial + COALESCE(SUM(vl.creditRial), 0)) THEN (a.openingDebitRial + COALESCE(SUM(vl.debitRial), 0)) - (a.openingCreditRial + COALESCE(SUM(vl.creditRial), 0)) ELSE 0 END AS debitRial, CASE WHEN (a.openingCreditRial + COALESCE(SUM(vl.creditRial), 0)) > (a.openingDebitRial + COALESCE(SUM(vl.debitRial), 0)) THEN (a.openingCreditRial + COALESCE(SUM(vl.creditRial), 0)) - (a.openingDebitRial + COALESCE(SUM(vl.debitRial), 0)) ELSE 0 END AS creditRial FROM accounts a LEFT JOIN voucher_lines vl ON vl.accountId = a.id GROUP BY a.id ORDER BY a.code")
    fun observeBalances(): Flow<List<AccountBalanceRow>>

    @Query("SELECT a.id AS accountId, a.code AS accountCode, a.title AS accountTitle, a.type AS accountType, a.openingDebitRial AS openingDebitRial, a.openingCreditRial AS openingCreditRial, COALESCE(SUM(vl.debitRial), 0) AS debitTurnoverRial, COALESCE(SUM(vl.creditRial), 0) AS creditTurnoverRial, CASE WHEN (a.openingDebitRial - a.openingCreditRial + COALESCE(SUM(vl.debitRial), 0) - COALESCE(SUM(vl.creditRial), 0)) > 0 THEN (a.openingDebitRial - a.openingCreditRial + COALESCE(SUM(vl.debitRial), 0) - COALESCE(SUM(vl.creditRial), 0)) ELSE 0 END AS endingDebitRial, CASE WHEN (a.openingCreditRial - a.openingDebitRial + COALESCE(SUM(vl.creditRial), 0) - COALESCE(SUM(vl.debitRial), 0)) > 0 THEN (a.openingCreditRial - a.openingDebitRial + COALESCE(SUM(vl.creditRial), 0) - COALESCE(SUM(vl.debitRial), 0)) ELSE 0 END AS endingCreditRial FROM accounts a LEFT JOIN voucher_lines vl ON vl.accountId = a.id GROUP BY a.id ORDER BY a.code")
    fun observeTrialBalance(): Flow<List<AccountTrialBalanceRow>>

    @Query("SELECT v.number AS voucherNumber, v.dateEpoch AS dateEpoch, v.description AS voucherDescription, v.reference AS reference, a.code AS accountCode, a.title AS accountTitle, vl.debitRial AS debitRial, vl.creditRial AS creditRial FROM voucher_lines vl INNER JOIN vouchers v ON v.id = vl.voucherId INNER JOIN accounts a ON a.id = vl.accountId ORDER BY v.dateEpoch DESC, v.id DESC, vl.id DESC")
    fun observeLedger(): Flow<List<LedgerRow>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(account: AccountEntity): Long

    @Query("SELECT * FROM accounts WHERE code = :code LIMIT 1")
    suspend fun byCode(code: String): AccountEntity?

    @Query("SELECT * FROM accounts WHERE id = :id LIMIT 1")
    suspend fun byId(id: Long): AccountEntity?

    @Update
    suspend fun update(account: AccountEntity)
}

@Dao
interface VoucherDao {
    @Insert
    suspend fun insert(voucher: VoucherEntity): Long

    @Query("SELECT * FROM vouchers WHERE reference = :reference LIMIT 1")
    suspend fun byReference(reference: String): VoucherEntity?

    @Query("SELECT * FROM vouchers WHERE number = :number LIMIT 1")
    suspend fun byNumber(number: String): VoucherEntity?

    @Query("SELECT COUNT(*) FROM vouchers")
    fun observeCount(): Flow<Int>
}

@Dao
interface VoucherLineDao {
    @Insert
    suspend fun insertAll(lines: List<VoucherLineEntity>)

    @Query("SELECT * FROM voucher_lines WHERE voucherId = :voucherId")
    suspend fun byVoucher(voucherId: Long): List<VoucherLineEntity>
}

@Dao
interface ImportOrderDao {
    @Query("SELECT * FROM import_orders ORDER BY orderedAt DESC")
    fun observeAll(): Flow<List<ImportOrderEntity>>

    @Query("SELECT * FROM import_orders WHERE containerCode = :containerCode LIMIT 1")
    suspend fun byContainerCode(containerCode: String): ImportOrderEntity?

    @Insert
    suspend fun insert(order: ImportOrderEntity): Long

    @Query("SELECT * FROM import_orders WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): ImportOrderEntity?

    @Update
    suspend fun update(order: ImportOrderEntity)

    @Query("SELECT COUNT(*) FROM import_orders")
    fun observeCount(): Flow<Int>
}

@Dao
interface ImportReceiptDao {
    @Insert
    suspend fun insert(receipt: ImportReceiptEntity): Long

    @Insert
    suspend fun insertLines(lines: List<ImportReceiptLineEntity>)

    @Query("SELECT * FROM import_receipts WHERE importOrderId = :orderId LIMIT 1")
    suspend fun byOrder(orderId: Long): ImportReceiptEntity?

    @Query("SELECT * FROM import_receipt_lines WHERE receiptId = :receiptId ORDER BY id")
    suspend fun linesByReceipt(receiptId: Long): List<ImportReceiptLineEntity>
}

@Dao
interface CheckDao {
    @Query("SELECT * FROM checks ORDER BY dueDateEpoch ASC, id DESC")
    fun observeAll(): Flow<List<CheckEntity>>

    @Insert
    suspend fun insert(check: CheckEntity): Long

    @Query("SELECT * FROM checks WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): CheckEntity?

    @Update
    suspend fun update(check: CheckEntity)
}

@Dao
interface TreasuryDao {
    @Query("SELECT * FROM treasury_entries ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<TreasuryEntryEntity>>

    @Insert
    suspend fun insert(entry: TreasuryEntryEntity): Long

    @Query("SELECT * FROM treasury_entries WHERE id = :id LIMIT 1")
    suspend fun byId(id: Long): TreasuryEntryEntity?

    @Query("SELECT COALESCE(SUM(amountRial), 0) FROM invoice_settlements WHERE treasuryEntryId = :entryId")
    suspend fun allocatedAmount(entryId: Long): Long
}


@Dao
interface BankStatementDao {
    @Query("SELECT * FROM bank_statement_lines ORDER BY transactionDateEpoch DESC, id DESC")
    fun observeAll(): Flow<List<BankStatementLineEntity>>

    @Insert
    suspend fun insert(line: BankStatementLineEntity): Long

    @Query("SELECT * FROM bank_statement_lines WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): BankStatementLineEntity?

    @Query("SELECT COUNT(*) FROM bank_statement_lines WHERE matchedTreasuryEntryId = :treasuryEntryId")
    suspend fun countMatches(treasuryEntryId: Long): Int

    @Query("SELECT COUNT(*) FROM bank_statement_lines WHERE matchedCheckId = :checkId")
    suspend fun countCheckMatches(checkId: Long): Int

    @Query("SELECT COUNT(*) FROM bank_statement_lines WHERE matchedVoucherId = :voucherId")
    suspend fun countVoucherMatches(voucherId: Long): Int

    @Update
    suspend fun update(line: BankStatementLineEntity)
}

@Dao
interface WarehouseDao {
    @Query("SELECT * FROM warehouses ORDER BY isDefault DESC, name")
    fun observeAll(): Flow<List<WarehouseEntity>>

    @Query("SELECT * FROM warehouses WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): WarehouseEntity?

    @Insert
    suspend fun insert(warehouse: WarehouseEntity): Long
}

@Dao
interface WarehouseStockDao {
    @Query("SELECT w.id AS warehouseId, w.name AS warehouseName, p.id AS productId, p.name AS productName, COALESCE(SUM(m.quantityKg), 0.0) AS quantityKg, COALESCE(v.valueRial, 0) AS valueRial, CASE WHEN COALESCE(v.quantityKg, 0) > 0 THEN CAST(v.valueRial / v.quantityKg AS INTEGER) ELSE 0 END AS averageCostPerKgRial FROM warehouses w CROSS JOIN products p LEFT JOIN warehouse_stock_movements m ON m.warehouseId = w.id AND m.productId = p.id LEFT JOIN warehouse_valuations v ON v.warehouseId = w.id AND v.productId = p.id GROUP BY w.id, p.id ORDER BY w.isDefault DESC, w.name, p.name")
    fun observeStocks(): Flow<List<WarehouseStockRow>>

    @Query("SELECT COALESCE(SUM(quantityKg), 0.0) FROM warehouse_stock_movements WHERE warehouseId = :warehouseId AND productId = :productId")
    suspend fun stockForProduct(warehouseId: Long, productId: Long): Double

    @Query("SELECT * FROM warehouse_valuations WHERE warehouseId = :warehouseId AND productId = :productId LIMIT 1")
    suspend fun valuation(warehouseId: Long, productId: Long): WarehouseValuationEntity?

    @Query("SELECT COALESCE(SUM(quantityKg), 0.0) AS quantityKg, COALESCE(SUM(valueRial), 0) AS valueRial FROM warehouse_valuations WHERE productId = :productId")
    suspend fun aggregateValuation(productId: Long): InventoryValuationAggregate

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertValuation(valuation: WarehouseValuationEntity)

    @Insert
    suspend fun insertMovement(movement: WarehouseStockMovementEntity)

    @Query("SELECT m.id AS id, w.id AS warehouseId, w.name AS warehouseName, p.name AS productName, m.quantityKg AS quantityKg, m.kind AS kind, m.referenceId AS referenceId, m.note AS note, m.createdAt AS createdAt FROM warehouse_stock_movements m INNER JOIN warehouses w ON w.id = m.warehouseId INNER JOIN products p ON p.id = m.productId ORDER BY m.createdAt DESC, m.id DESC LIMIT 250")
    fun observeKardex(): Flow<List<WarehouseKardexRow>>
}

data class InventoryValuationAggregate(val quantityKg: Double, val valueRial: Long)

@Dao
interface InvoiceReturnDao {
    @Insert
    suspend fun insert(returnEntry: InvoiceReturnEntity): Long

    @Insert
    suspend fun insertLines(lines: List<InvoiceReturnLineEntity>)

    @Query("SELECT il.invoiceId AS invoiceId, il.id AS invoiceLineId, il.productId AS productId, p.name AS productName, il.quantityKg AS originalQuantityKg, COALESCE(SUM(irl.quantityKg), 0.0) AS returnedQuantityKg, il.unitPriceRial AS unitPriceRial, il.lineTotalRial AS lineTotalRial, il.inventoryCostRial AS inventoryCostRial FROM invoice_lines il INNER JOIN products p ON p.id = il.productId LEFT JOIN invoice_return_lines irl ON irl.invoiceLineId = il.id GROUP BY il.id ORDER BY il.id")
    fun observeReturnableLines(): Flow<List<ReturnableInvoiceLineRow>>

    @Query("SELECT il.invoiceId AS invoiceId, il.id AS invoiceLineId, il.productId AS productId, p.name AS productName, il.quantityKg AS originalQuantityKg, COALESCE(SUM(irl.quantityKg), 0.0) AS returnedQuantityKg, il.unitPriceRial AS unitPriceRial, il.lineTotalRial AS lineTotalRial, il.inventoryCostRial AS inventoryCostRial FROM invoice_lines il INNER JOIN products p ON p.id = il.productId LEFT JOIN invoice_return_lines irl ON irl.invoiceLineId = il.id WHERE il.invoiceId = :invoiceId GROUP BY il.id ORDER BY il.id")
    suspend fun returnableLinesForInvoice(invoiceId: Long): List<ReturnableInvoiceLineRow>

    @Query("SELECT invoiceId, COALESCE(SUM(amountRial), 0) AS returnedRial FROM invoice_returns GROUP BY invoiceId")
    fun observeTotals(): Flow<List<InvoiceReturnSummaryRow>>

    @Query("SELECT COALESCE(SUM(amountRial), 0) FROM invoice_returns WHERE invoiceId = :invoiceId")
    suspend fun returnedForInvoice(invoiceId: Long): Long

    @Query("SELECT COALESCE(SUM(inventoryCostRial), 0) FROM invoice_return_lines WHERE invoiceLineId = :invoiceLineId")
    suspend fun returnedCostForInvoiceLine(invoiceLineId: Long): Long
}

@Dao
interface InvoiceSettlementDao {
    @Query("SELECT treasuryEntryId AS entryId, COALESCE(SUM(amountRial), 0) AS allocatedRial FROM invoice_settlements GROUP BY treasuryEntryId")
    fun observeTreasuryAllocations(): Flow<List<TreasuryAllocationRow>>

    @Query("SELECT s.id AS settlementId, s.invoiceId AS invoiceId, s.treasuryEntryId AS treasuryEntryId, s.amountRial AS amountRial, s.createdAt AS createdAt, t.kind AS entryKind, t.method AS method, t.referenceNumber AS referenceNumber, t.createdAt AS entryCreatedAt FROM invoice_settlements s INNER JOIN treasury_entries t ON t.id = s.treasuryEntryId ORDER BY s.createdAt DESC, s.id DESC")
    fun observeDetails(): Flow<List<InvoiceSettlementDetailRow>>

    @Query("SELECT * FROM invoice_settlements WHERE id = :settlementId LIMIT 1")
    suspend fun byId(settlementId: Long): InvoiceSettlementEntity?

    @Query("DELETE FROM invoice_settlements WHERE id = :settlementId")
    suspend fun deleteById(settlementId: Long): Int

    @Insert
    suspend fun insert(settlement: InvoiceSettlementEntity): Long

    @Query("SELECT * FROM invoice_settlements WHERE invoiceId = :invoiceId ORDER BY createdAt, id")
    suspend fun byInvoice(invoiceId: Long): List<InvoiceSettlementEntity>

    @Query("SELECT * FROM invoice_settlements WHERE treasuryEntryId = :entryId ORDER BY createdAt, id")
    suspend fun byTreasuryEntry(entryId: Long): List<InvoiceSettlementEntity>
}
