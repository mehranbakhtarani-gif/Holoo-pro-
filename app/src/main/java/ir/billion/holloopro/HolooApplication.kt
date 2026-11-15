package ir.billion.holloopro

import android.app.Application
import ir.billion.holloopro.data.AccountingRepository
import ir.billion.holloopro.data.AppDatabase

class HolooApplication : Application() {
    val database by lazy { AppDatabase.getInstance(this) }
    val repository by lazy { AccountingRepository(database) }
}
