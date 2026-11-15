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
        ImportReceiptLineEntity::class,
        ProductValuationEntity::class,
        CheckEntity::class
    ],
    version = 7,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun productDao(): ProductDao
    abstract fun partyDao(): PartyDao
    abstract fun invoiceDao(): InvoiceDao
    abstract fun invoiceLineDao(): InvoiceLineDao
    abstract fun stockDao(): StockDao
    abstract fun productValuationDao(): ProductValuationDao
    abstract fun partyLedgerDao(): PartyLedgerDao
    abstract fun accountDao(): AccountDao
    abstract fun voucherDao(): VoucherDao
    abstract fun voucherLineDao(): VoucherLineDao
    abstract fun importOrderDao(): ImportOrderDao
    abstract fun importReceiptDao(): ImportReceiptDao
    abstract fun treasuryDao(): TreasuryDao
    abstract fun checkDao(): CheckDao

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

        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS product_valuations (productId INTEGER NOT NULL PRIMARY KEY, quantityKg REAL NOT NULL, valueRial INTEGER NOT NULL, updatedAt INTEGER NOT NULL)")
                db.execSQL("ALTER TABLE invoice_lines ADD COLUMN inventoryCostRial INTEGER NOT NULL DEFAULT 0")
            }
        }

        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS checks (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, checkNumber TEXT NOT NULL, kind TEXT NOT NULL, partyId INTEGER NOT NULL, amountRial INTEGER NOT NULL, issueDateEpoch INTEGER NOT NULL, dueDateEpoch INTEGER NOT NULL, bankName TEXT NOT NULL, status TEXT NOT NULL, note TEXT NOT NULL, createdAt INTEGER NOT NULL)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_checks_checkNumber ON checks(checkNumber)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_checks_partyId_dueDateEpoch ON checks(partyId, dueDateEpoch)")
            }
        }

        val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE accounts ADD COLUMN openingDebitRial INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE accounts ADD COLUMN openingCreditRial INTEGER NOT NULL DEFAULT 0")
            }
        }

        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    DATABASE_NAME
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7).build().also { INSTANCE = it }
            }
    }
}
