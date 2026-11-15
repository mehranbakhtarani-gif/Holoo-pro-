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
        CheckEntity::class,
        InvoiceSettlementEntity::class,
        InvoiceReturnEntity::class,
        InvoiceReturnLineEntity::class,
        WarehouseEntity::class,
        WarehouseStockMovementEntity::class,
        WarehouseValuationEntity::class
    ],
    version = 12,
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
    abstract fun invoiceSettlementDao(): InvoiceSettlementDao
    abstract fun invoiceReturnDao(): InvoiceReturnDao
    abstract fun warehouseDao(): WarehouseDao
    abstract fun warehouseStockDao(): WarehouseStockDao

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

        val MIGRATION_7_8 = object : Migration(7, 8) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS invoice_settlements (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, invoiceId INTEGER NOT NULL, treasuryEntryId INTEGER NOT NULL, amountRial INTEGER NOT NULL, createdAt INTEGER NOT NULL)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_invoice_settlements_invoiceId ON invoice_settlements(invoiceId)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_invoice_settlements_treasuryEntryId ON invoice_settlements(treasuryEntryId)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_invoice_settlements_treasuryEntryId_invoiceId ON invoice_settlements(treasuryEntryId, invoiceId)")
            }
        }

        val MIGRATION_8_9 = object : Migration(8, 9) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS invoice_returns (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, invoiceId INTEGER NOT NULL, amountRial INTEGER NOT NULL, note TEXT NOT NULL, createdAt INTEGER NOT NULL)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_invoice_returns_invoiceId ON invoice_returns(invoiceId)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_invoice_returns_createdAt ON invoice_returns(createdAt)")
                db.execSQL("CREATE TABLE IF NOT EXISTS invoice_return_lines (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, returnId INTEGER NOT NULL, invoiceLineId INTEGER NOT NULL, quantityKg REAL NOT NULL, refundAmountRial INTEGER NOT NULL, inventoryCostRial INTEGER NOT NULL)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_invoice_return_lines_returnId ON invoice_return_lines(returnId)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_invoice_return_lines_invoiceLineId ON invoice_return_lines(invoiceLineId)")
            }
        }

        val MIGRATION_9_10 = object : Migration(9, 10) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE invoices ADD COLUMN extraCostsRial INTEGER NOT NULL DEFAULT 0")
            }
        }

        val MIGRATION_10_11 = object : Migration(10, 11) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE invoice_return_lines ADD COLUMN netSalesRial INTEGER NOT NULL DEFAULT 0")
            }
        }

        val MIGRATION_11_12 = object : Migration(11, 12) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE invoices ADD COLUMN warehouseId INTEGER NOT NULL DEFAULT 1")
                db.execSQL("CREATE TABLE IF NOT EXISTS warehouses (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, address TEXT NOT NULL, isDefault INTEGER NOT NULL, createdAt INTEGER NOT NULL)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_warehouses_name ON warehouses(name)")
                db.execSQL("INSERT INTO warehouses (id, name, address, isDefault, createdAt) VALUES (1, 'انبار اصلی', '', 1, CAST(strftime('%s','now') AS INTEGER) * 1000)")
                db.execSQL("CREATE TABLE IF NOT EXISTS warehouse_stock_movements (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, warehouseId INTEGER NOT NULL, productId INTEGER NOT NULL, quantityKg REAL NOT NULL, kind TEXT NOT NULL, referenceId INTEGER NOT NULL, note TEXT NOT NULL, createdAt INTEGER NOT NULL)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_warehouse_stock_movements_warehouseId_productId_createdAt ON warehouse_stock_movements(warehouseId, productId, createdAt)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_warehouse_stock_movements_productId ON warehouse_stock_movements(productId)")
                db.execSQL("INSERT INTO warehouse_stock_movements (warehouseId, productId, quantityKg, kind, referenceId, note, createdAt) SELECT 1, productId, quantityKg, kind, referenceId, note, createdAt FROM stock_movements")
                db.execSQL("CREATE TABLE IF NOT EXISTS warehouse_valuations (warehouseId INTEGER NOT NULL, productId INTEGER NOT NULL, quantityKg REAL NOT NULL, valueRial INTEGER NOT NULL, updatedAt INTEGER NOT NULL, PRIMARY KEY(warehouseId, productId))")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_warehouse_valuations_productId ON warehouse_valuations(productId)")
                db.execSQL("INSERT INTO warehouse_valuations (warehouseId, productId, quantityKg, valueRial, updatedAt) SELECT 1, productId, quantityKg, valueRial, updatedAt FROM product_valuations")
            }
        }

        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    DATABASE_NAME
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7, MIGRATION_7_8, MIGRATION_8_9, MIGRATION_9_10, MIGRATION_10_11, MIGRATION_11_12).build().also { INSTANCE = it }
            }
    }
}
