package ir.billion.holloopro.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ProductDao {
    @Query("SELECT p.*, COALESCE(SUM(sm.quantityKg), 0.0) AS stockKg FROM products p LEFT JOIN stock_movements sm ON sm.productId = p.id GROUP BY p.id ORDER BY p.name")
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
}

@Dao
interface PartyDao {
    @Query("SELECT * FROM parties ORDER BY name")
    fun observeAll(): Flow<List<PartyEntity>>

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
}

@Dao
interface AccountDao {
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

    @Insert
    suspend fun insert(order: ImportOrderEntity): Long

    @Query("SELECT COUNT(*) FROM import_orders")
    fun observeCount(): Flow<Int>
}

@Dao
interface TreasuryDao {
    @Query("SELECT * FROM treasury_entries ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<TreasuryEntryEntity>>

    @Insert
    suspend fun insert(entry: TreasuryEntryEntity): Long
}
