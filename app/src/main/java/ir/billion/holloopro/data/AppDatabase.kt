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
        ImportOrderEntity::class
    ],
    version = 2,
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

    companion object {
        private const val DATABASE_NAME = "holoo_pro_plus.db"

        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE products ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
            }
        }

        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    DATABASE_NAME
                ).addMigrations(MIGRATION_1_2).build().also { INSTANCE = it }
            }
    }
}
