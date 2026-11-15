package ir.billion.holloopro.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        ProductEntity::class,
        PartyEntity::class,
        InvoiceEntity::class,
        InvoiceLineEntity::class,
        StockMovementEntity::class,
        PartyLedgerEntity::class,
        AccountEntity::class,
        VoucherEntity::class,
        VoucherLineEntity::class,
        ImportOrderEntity::class,
        TreasuryEntryEntity::class,
        ImportReceiptEntity::class,
        ImportReceiptLineEntity::class
    ],
    version = 4,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun productDao(): ProductDao
    abstract fun partyDao(): PartyDao
    abstract fun invoiceDao(): InvoiceDao
    abstract fun invoiceLineDao(): InvoiceLineDao
    abstract fun stockDao(): StockDao
    abstract fun partyLedgerDao(): PartyLedgerDao
    abstract fun accountDao(): AccountDao
    abstract fun voucherDao(): VoucherDao
    abstract fun voucherLineDao(): VoucherLineDao
    abstract fun importOrderDao(): ImportOrderDao
    abstract fun importReceiptDao(): ImportReceiptDao
    abstract fun treasuryDao(): TreasuryDao

    companion object {
        private const val DATABASE_NAME = "holoo_pro_plus.db"

        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE products ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
            }
        }

        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS treasury_entries (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, kind TEXT NOT NULL, method TEXT NOT NULL, partyId INTEGER NOT NULL, amountRial INTEGER NOT NULL, referenceNumber TEXT NOT NULL, note TEXT NOT NULL, createdAt INTEGER NOT NULL)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_treasury_entries_partyId_createdAt ON treasury_entries(partyId, createdAt)")
            }
        }


        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS import_receipts (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, importOrderId INTEGER NOT NULL, goodsCostRial INTEGER NOT NULL, totalCostRial INTEGER NOT NULL, receivedAt INTEGER NOT NULL)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_import_receipts_importOrderId ON import_receipts(importOrderId)")
                db.execSQL("CREATE TABLE IF NOT EXISTS import_receipt_lines (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, receiptId INTEGER NOT NULL, productId INTEGER NOT NULL, quantityKg REAL NOT NULL, allocatedCostRial INTEGER NOT NULL)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_import_receipt_lines_receiptId ON import_receipt_lines(receiptId)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_import_receipt_lines_productId ON import_receipt_lines(productId)")
            }
        }

        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    DATABASE_NAME
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4).build().also { INSTANCE = it }
            }
    }
}
