package ir.billion.holloopro.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import androidx.room.RoomDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * Full local Room database backup. The export checkpoints WAL first so committed
 * transactions are included in the single portable SQLite file.
 */
object DatabaseBackup {
    suspend fun export(context: Context, db: RoomDatabase, destination: Uri) = withContext(Dispatchers.IO) {
        db.openHelper.writableDatabase.query("PRAGMA wal_checkpoint(FULL)").use { }
        val source = context.getDatabasePath("holoo_pro_plus.db")
        require(source.isFile && source.length() > 0L) { "فایل پایگاه داده پیدا نشد" }
        val output = context.contentResolver.openOutputStream(destination, "wt")
            ?: error("امکان نوشتن فایل پشتیبان وجود ندارد")
        FileInputStream(source).use { input ->
            output.use { target -> input.copyTo(target) }
        }
    }

    suspend fun restore(context: Context, db: RoomDatabase, sourceUri: Uri) = withContext(Dispatchers.IO) {
        val databaseFile = context.getDatabasePath("holoo_pro_plus.db")
        val parent = databaseFile.parentFile ?: error("مسیر پایگاه داده نامعتبر است")
        val temp = File(parent, "holoo_restore_${System.currentTimeMillis()}.tmp")
        try {
            val input = context.contentResolver.openInputStream(sourceUri)
                ?: error("فایل انتخاب‌شده قابل خواندن نیست")
            input.use { incoming -> FileOutputStream(temp).use { target -> incoming.copyTo(target) } }
            require(temp.length() > 100L) { "فایل پشتیبان خالی یا ناقص است" }
            FileInputStream(temp).use { stream ->
                val header = ByteArray(16)
                require(stream.read(header) == 16 && String(header, Charsets.US_ASCII) == "SQLite format 3\u0000") {
                    "فایل انتخاب‌شده پایگاه داده SQLite معتبر نیست"
                }
            }
            SQLiteDatabase.openDatabase(temp.absolutePath, null, SQLiteDatabase.OPEN_READONLY).use { checkDb ->
                checkDb.rawQuery("PRAGMA integrity_check", null).use { cursor ->
                    require(cursor.moveToFirst() && cursor.getString(0) == "ok") { "سلامت فایل پشتیبان تأیید نشد" }
                }
                checkDb.rawQuery("PRAGMA user_version", null).use { cursor ->
                    require(cursor.moveToFirst() && cursor.getInt(0) in 1..7) { "نسخه پایگاه داده با این برنامه سازگار نیست" }
                }
                checkDb.rawQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='products'", null).use { cursor ->
                    require(cursor.moveToFirst()) { "این فایل، پشتیبان HOLLOO PRO+ نیست" }
                }
            }
            db.close()
            File(databaseFile.path + "-wal").delete()
            File(databaseFile.path + "-shm").delete()
            Files.move(temp.toPath(), databaseFile.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
        } finally {
            temp.delete()
        }
    }
}
