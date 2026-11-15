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

    @Insert
    suspend fun insert(product: ProductEntity): Long

    @Update
    suspend fun update(product: ProductEntity)

    @Query("DELETE FROM products WHERE id = :id")
    suspend fun delete(id: Long)

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

    @Query("SELECT (SELECT COUNT(*) FROM invoices WHERE partyId = :id) + (SELECT COUNT(*) FROM treasury_entries WHERE partyId = :id) + (SELECT COUNT(*) FROM party_ledger WHERE partyId = :id)")
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

    @Query("SELECT COALESCE((SELECT SUM(subtotalRial - discountRial) FROM invoices WHERE kind = 'SALE' AND status = 'POSTED'), 0) AS salesRial, COALESCE((SELECT SUM(il.inventoryCostRial) FROM invoice_lines il INNER JOIN invoices i ON i.id = il.invoiceId WHERE i.kind = 'SALE' AND i.status = 'POSTED'), 0) AS costOfGoodsSoldRial")
    fun observeProfitLoss(): Flow<ProfitLossRow>

    @Query("SELECT COUNT(*) FROM invoices")
    fun observeCount(): Flow<Int>
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
    @Query("SELECT a.id AS accountId, a.code AS accountCode, a.title AS accountTitle, a.type AS accountType, CASE WHEN COALESCE(SUM(vl.debitRial), 0) > COALESCE(SUM(vl.creditRial), 0) THEN COALESCE(SUM(vl.debitRial), 0) - COALESCE(SUM(vl.creditRial), 0) ELSE 0 END AS debitRial, CASE WHEN COALESCE(SUM(vl.creditRial), 0) > COALESCE(SUM(vl.debitRial), 0) THEN COALESCE(SUM(vl.creditRial), 0) - COALESCE(SUM(vl.debitRial), 0) ELSE 0 END AS creditRial FROM accounts a LEFT JOIN voucher_lines vl ON vl.accountId = a.id GROUP BY a.id ORDER BY a.code")
    fun observeBalances(): Flow<List<AccountBalanceRow>>

    @Query("SELECT a.id AS accountId, a.code AS accountCode, a.title AS accountTitle, a.type AS accountType, a.openingDebitRial AS openingDebitRial, a.openingCreditRial AS openingCreditRial, COALESCE(SUM(vl.debitRial), 0) AS debitTurnoverRial, COALESCE(SUM(vl.creditRial), 0) AS creditTurnoverRial, CASE WHEN (a.openingDebitRial - a.openingCreditRial + COALESCE(SUM(vl.debitRial), 0) - COALESCE(SUM(vl.creditRial), 0)) > 0 THEN (a.openingDebitRial - a.openingCreditRial + COALESCE(SUM(vl.debitRial), 0) - COALESCE(SUM(vl.creditRial), 0)) ELSE 0 END AS endingDebitRial, CASE WHEN (a.openingCreditRial - a.openingDebitRial + COALESCE(SUM(vl.creditRial), 0) - COALESCE(SUM(vl.debitRial), 0)) > 0 THEN (a.openingCreditRial - a.openingDebitRial + COALESCE(SUM(vl.creditRial), 0) - COALESCE(SUM(vl.debitRial), 0)) ELSE 0 END AS endingCreditRial FROM accounts a LEFT JOIN voucher_lines vl ON vl.accountId = a.id GROUP BY a.id ORDER BY a.code")
    fun observeTrialBalance(): Flow<List<AccountTrialBalanceRow>>

    @Query("SELECT v.number AS voucherNumber, v.dateEpoch AS dateEpoch, v.description AS voucherDescription, a.code AS accountCode, a.title AS accountTitle, vl.debitRial AS debitRial, vl.creditRial AS creditRial FROM voucher_lines vl INNER JOIN vouchers v ON v.id = vl.voucherId INNER JOIN accounts a ON a.id = vl.accountId ORDER BY v.dateEpoch DESC, v.id DESC, vl.id DESC")
    fun observeLedger(): Flow<List<LedgerRow>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(account: AccountEntity): Long

    @Query("SELECT * FROM accounts WHERE code = :code LIMIT 1")
    suspend fun byCode(code: String): AccountEntity?
}

@Dao
interface VoucherDao {
    @Insert
    suspend fun insert(voucher: VoucherEntity): Long

    @Query("SELECT * FROM vouchers WHERE reference = :reference LIMIT 1")
    suspend fun byReference(reference: String): VoucherEntity?

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
}
