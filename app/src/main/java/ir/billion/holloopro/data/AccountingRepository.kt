package ir.billion.holloopro.data

import androidx.room.withTransaction
import ir.billion.holloopro.accounting.AccountingEngine
import ir.billion.holloopro.accounting.LandedCostCalculator
import ir.billion.holloopro.accounting.InventoryValuation
import ir.billion.holloopro.accounting.InventoryValuationEngine
import ir.billion.holloopro.accounting.VoucherLineDraft
import java.math.BigDecimal
import java.util.Locale
import java.util.UUID

class AccountingRepository(private val db: AppDatabase) {
    val products = db.productDao().observeWithStock()
    val parties = db.partyDao().observeAll()
    val partyBalances = db.partyDao().observeBalances()
    fun partyLedger(partyId: Long) = db.partyLedgerDao().observeForParty(partyId)
    val suppliers = db.partyDao().observeSuppliers()
    val invoices = db.invoiceDao().observeAll()
    val imports = db.importOrderDao().observeAll()
    val productCount = db.productDao().observeCount()
    val partyCount = db.partyDao().observeCount()
    val invoiceCount = db.invoiceDao().observeCount()
    val voucherCount = db.voucherDao().observeCount()
    val importCount = db.importOrderDao().observeCount()
    val treasury = db.treasuryDao().observeAll()
    val accountBalances = db.accountDao().observeBalances()
    val trialBalance = db.accountDao().observeTrialBalance()
    val ledger = db.accountDao().observeLedger()
    val checks = db.checkDao().observeAll()
    val profitLoss = db.invoiceDao().observeProfitLoss()

    suspend fun addProduct(
        sku: String, name: String, groupName: String, yarnType: String,
        color: String, denier: Int, twisted: Boolean, notes: String
    ) {
        require(sku.isNotBlank()) { "کد کالا الزامی است" }
        require(name.isNotBlank()) { "نام کالا الزامی است" }
        require(denier > 0) { "دنیر باید عددی مثبت باشد" }
        db.productDao().insert(
            ProductEntity(
                sku = sku.trim().uppercase(Locale.ROOT),
                name = name.trim(),
                groupName = groupName.trim(),
                yarnType = yarnType.trim().uppercase(Locale.ROOT),
                color = color.trim(),
                denier = denier,
                twisted = twisted,
                notes = notes.trim()
            )
        )
    }

    suspend fun updateProduct(id: Long, sku: String, name: String, groupName: String, yarnType: String, color: String, denier: Int, twisted: Boolean, notes: String) {
        require(sku.isNotBlank()) { "کد کالا الزامی است" }
        require(name.isNotBlank()) { "نام کالا الزامی است" }
        require(denier > 0) { "دنیر باید عددی مثبت باشد" }
        val old = db.productDao().getById(id) ?: error("کالا پیدا نشد")
        db.productDao().update(old.copy(sku = sku.trim().uppercase(Locale.ROOT), name = name.trim(), groupName = groupName.trim(), yarnType = yarnType.trim().uppercase(Locale.ROOT), color = color.trim(), denier = denier, twisted = twisted, notes = notes.trim()))
    }

    suspend fun setOpeningInventoryValuation(productId: Long, costPerKgRial: Long) {
        require(costPerKgRial > 0) { "بهای هر کیلو باید بیشتر از صفر باشد" }
        db.withTransaction {
            val product = db.productDao().getById(productId) ?: error("کالا پیدا نشد")
            val stock = db.stockDao().stockForProduct(productId)
            require(stock.isFinite() && stock > 0.000001) { "برای این کالا موجودی مثبت ثبت نشده است" }
            require(db.productValuationDao().get(productId) == null) { "ارزش موجودی این کالا قبلاً ثبت شده است" }
            val value = BigDecimal.valueOf(stock).multiply(BigDecimal.valueOf(costPerKgRial))
                .setScale(0, java.math.RoundingMode.HALF_UP).longValueExact()
            require(value > 0) { "ارزش موجودی باید بیشتر از صفر باشد" }
            db.productValuationDao().upsert(ProductValuationEntity(productId, stock, value))
        }
    }

    suspend fun adjustStock(productId: Long, deltaKg: Double, costPerKgRial: Long) {
        require(deltaKg.isFinite() && kotlin.math.abs(deltaKg) > 0.000001) { "مقدار اصلاح موجودی نباید صفر باشد" }
        require(costPerKgRial >= 0) { "بهای هر کیلو معتبر نیست" }
        db.withTransaction {
            val product = db.productDao().getById(productId) ?: error("کالا پیدا نشد")
            val stock = db.stockDao().stockForProduct(productId)
            val stored = db.productValuationDao().get(productId)
            if (stored == null && stock > 0.000001) {
                error("ابتدا بهای افتتاحیه موجودی این کالا را ثبت کنید")
            }
            val current = stored?.let { InventoryValuation(it.quantityKg, it.valueRial) }
                ?: InventoryValuation(0.0, 0L)
            val next: InventoryValuation
            val adjustmentValue: Long
            val debitCode: String
            val creditCode: String
            if (deltaKg > 0) {
                require(costPerKgRial > 0) { "برای افزایش موجودی، بهای هر کیلو الزامی است" }
                val receivedValue = BigDecimal.valueOf(deltaKg)
                    .multiply(BigDecimal.valueOf(costPerKgRial))
                    .setScale(0, java.math.RoundingMode.HALF_UP).longValueExact()
                require(receivedValue > 0) { "ارزش افزایش موجودی باید بیشتر از صفر باشد" }
                next = InventoryValuationEngine.receive(current, deltaKg, receivedValue)
                adjustmentValue = receivedValue
                debitCode = "1301"
                creditCode = "4201"
            } else {
                require(stored != null && current.quantityKg > 0.000001) { "برای کاهش موجودی، بهای موجودی باید مشخص باشد" }
                val issue = InventoryValuationEngine.issue(current, -deltaKg)
                next = issue.remaining
                adjustmentValue = issue.cogsRial
                debitCode = "5201"
                creditCode = "1301"
            }
            db.productValuationDao().upsert(ProductValuationEntity(productId, next.quantityKg, next.valueRial))
            db.stockDao().insert(
                StockMovementEntity(
                    productId = productId,
                    quantityKg = deltaKg,
                    kind = "STOCKTAKE_ADJUSTMENT",
                    note = "اصلاح موجودی انبار: ${product.name}"
                )
            )
            ensureBaseAccounts()
            val debitAccount = db.accountDao().byCode(debitCode) ?: error("حساب اصلاح موجودی پیدا نشد")
            val creditAccount = db.accountDao().byCode(creditCode) ?: error("حساب اصلاح موجودی پیدا نشد")
            val voucherId = db.voucherDao().insert(
                VoucherEntity(
                    number = "ADJ-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(6)}",
                    description = "اصلاح موجودی کالا: ${product.name}",
                    reference = "STOCK_ADJUSTMENT:${productId}:${System.currentTimeMillis()}"
                )
            )
            db.voucherLineDao().insertAll(
                listOf(
                    VoucherLineEntity(voucherId = voucherId, accountId = debitAccount.id, debitRial = adjustmentValue, creditRial = 0, description = "اصلاح موجودی"),
                    VoucherLineEntity(voucherId = voucherId, accountId = creditAccount.id, debitRial = 0, creditRial = adjustmentValue, description = "اصلاح موجودی")
                )
            )
        }
    }

    suspend fun deleteProduct(id: Long) {
        val stock = db.stockDao().stockForProduct(id)
        require(kotlin.math.abs(stock) < 0.000001) { "کالای دارای موجودی را نمی‌توان حذف کرد" }
        require(db.productDao().invoiceLineCount(id) == 0 && db.productDao().movementCount(id) == 0) { "کالا سابقه فاکتور یا گردش انبار دارد؛ برای حفظ سوابق حذف نمی‌شود" }
        db.productDao().delete(id)
    }

    suspend fun addParty(name: String, kind: String, phone: String, address: String, openingBalanceRial: Long) {
        require(name.isNotBlank()) { "نام شخص الزامی است" }
        require(kind in setOf("CUSTOMER", "SUPPLIER", "BOTH"))
        db.partyDao().insert(
            PartyEntity(
                name = name.trim(),
                kind = kind,
                phone = phone.trim(),
                address = address.trim(),
                openingBalanceRial = openingBalanceRial
            )
        )
    }

    suspend fun updateParty(id: Long, name: String, kind: String, phone: String, address: String, openingBalanceRial: Long) {
        require(name.isNotBlank()) { "نام شخص الزامی است" }
        require(kind in setOf("CUSTOMER", "SUPPLIER", "BOTH"))
        val old = db.partyDao().getById(id) ?: error("شخص پیدا نشد")
        db.partyDao().update(old.copy(name = name.trim(), kind = kind, phone = phone.trim(), address = address.trim(), openingBalanceRial = openingBalanceRial))
    }

    suspend fun deleteParty(id: Long) {
        require(db.partyDao().linkedRecordCount(id) == 0) { "این شخص سابقه فاکتور، دریافت یا پرداخت دارد؛ برای حفظ سوابق حذف نمی‌شود" }
        db.partyDao().delete(id)
    }

    suspend fun createAndPostInvoice(
        kind: String, partyId: Long, productId: Long, quantityKg: Double,
        unitPriceRial: Long, discountRial: Long, taxRial: Long
    ) = createAndPostMultiLineInvoice(
        kind, partyId, listOf(InvoiceLineInput(productId, quantityKg, unitPriceRial)),
        discountRial, taxRial
    )

    suspend fun createAndPostMultiLineInvoice(kind: String, partyId: Long, lines: List<InvoiceLineInput>, discountRial: Long, taxRial: Long) {
        require(kind == "SALE" || kind == "PURCHASE")
        require(lines.isNotEmpty()) { "فاکتور باید حداقل یک ردیف کالا داشته باشد" }
        require(discountRial >= 0 && taxRial >= 0)
        lines.forEach { require(it.quantityKg > 0 && it.quantityKg.isFinite() && it.unitPriceRial > 0) { "مقدار و قیمت هر ردیف باید مثبت باشد" } }
        val amounts = lines.map { line -> BigDecimal.valueOf(line.quantityKg).multiply(BigDecimal.valueOf(line.unitPriceRial)).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact() }
        val subtotal = amounts.fold(0L) { sum, amount -> Math.addExact(sum, amount) }
        require(discountRial <= subtotal) { "تخفیف از مبلغ کالا بیشتر است" }
        val netGoods = Math.subtractExact(subtotal, discountRial)
        require(netGoods > 0) { "مبلغ خالص کالا پس از تخفیف باید بیشتر از صفر باشد" }
        val total = Math.addExact(netGoods, taxRial)
        require(total > 0) { "مبلغ فاکتور باید بیشتر از صفر باشد" }
        db.withTransaction {
            val party = db.partyDao().getById(partyId) ?: error("طرف حساب پیدا نشد")
            if (kind == "SALE") require(party.kind != "SUPPLIER") { "برای فروش، مشتری انتخاب کنید" } else require(party.kind != "CUSTOMER") { "برای خرید، تأمین‌کننده انتخاب کنید" }
            val requestedByProduct = AccountingEngine.aggregateQuantities(lines.map { it.productId to it.quantityKg })
            if (kind == "SALE") {
                requestedByProduct.forEach { (productId, requestedKg) ->
                    val product = db.productDao().getById(productId) ?: error("یکی از کالاهای فاکتور پیدا نشد")
                    val available = db.stockDao().stockForProduct(productId)
                    require(available.isFinite() && available + 0.000001 >= requestedKg) {
                        "موجودی " + product.name + " کافی نیست؛ موجودی: " + available +
                            " کیلوگرم، مقدار درخواستی: " + requestedKg + " کیلوگرم"
                    }
                }
            }
            val resolved = lines.mapIndexed { index, line ->
                val product = db.productDao().getById(line.productId) ?: error("یکی از کالاهای فاکتور پیدا نشد")
                Triple(line, product, amounts[index])
            }
            val lineCosts = if (kind == "PURCHASE") {
                AccountingEngine.allocateLandedCost(total, amounts.mapIndexed { index, amount -> (index + 1L) to amount.toDouble() })
            } else emptyMap()
            val inventoryCosts = mutableListOf<Long>()
            resolved.forEachIndexed { index, (line, product, _) ->
                val existing = db.productValuationDao().get(line.productId)
                val current = existing?.let { InventoryValuation(it.quantityKg, it.valueRial) }
                    ?: InventoryValuation(0.0, 0L)
                val next = if (kind == "PURCHASE") {
                    InventoryValuationEngine.receive(current, line.quantityKg, lineCosts[index + 1L] ?: error("تخصیص بهای خرید ناموفق بود"))
                } else {
                    require(existing != null && current.quantityKg > 0.0) {
                        "بهای موجودی «" + product.name + "» مشخص نیست؛ ابتدا رسید واردات یا خرید دارای بهای ثبت‌شده ایجاد کنید"
                    }
                    val issue = InventoryValuationEngine.issue(current, line.quantityKg)
                    inventoryCosts.add(issue.cogsRial)
                    issue.remaining
                }
                if (kind == "PURCHASE") inventoryCosts.add(lineCosts[index + 1L] ?: 0L)
                db.productValuationDao().upsert(ProductValuationEntity(line.productId, next.quantityKg, next.valueRial))
            }
            val number = "HP-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().take(8)
            val invoiceId = db.invoiceDao().insert(InvoiceEntity(number = number, kind = kind, partyId = partyId, subtotalRial = subtotal, discountRial = discountRial, taxRial = taxRial, totalRial = total, status = "POSTED"))
            db.invoiceLineDao().insertAll(resolved.mapIndexed { index, (line, _, amount) -> InvoiceLineEntity(invoiceId = invoiceId, productId = line.productId, quantityKg = line.quantityKg, unitPriceRial = line.unitPriceRial, lineTotalRial = amount, inventoryCostRial = inventoryCosts[index]) })
            resolved.forEach { (line, _, _) -> db.stockDao().insert(StockMovementEntity(productId = line.productId, quantityKg = if (kind == "SALE") -line.quantityKg else line.quantityKg, kind = if (kind == "SALE") "SALE" else "PURCHASE", referenceId = invoiceId, note = number)) }
            ensureBaseAccounts()
            val drafts = AccountingEngine.invoicePostingLines(kind, subtotal, discountRial, taxRial)
            val voucherId = db.voucherDao().insert(VoucherEntity(number = "S-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().take(8), description = if (kind == "SALE") "ثبت فروش چندردیفی " + number else "ثبت خرید چندردیفی " + number, reference = "INVOICE:" + invoiceId))
            val voucherLines = drafts.map { draft ->
                val account = db.accountDao().byCode(draft.accountCode)
                    ?: error("حساب ${draft.accountCode} تعریف نشده")
                VoucherLineEntity(
                    voucherId = voucherId, accountId = account.id,
                    debitRial = draft.debitRial, creditRial = draft.creditRial
                )
            }.toMutableList()
            if (kind == "SALE") {
                val cogs = inventoryCosts.fold(0L) { sum, value -> Math.addExact(sum, value) }
                if (cogs > 0) {
                    val inventoryAccount = db.accountDao().byCode("1301") ?: error("حساب موجودی تعریف نشده")
                    val cogsAccount = db.accountDao().byCode("5101") ?: error("حساب بهای تمام‌شده تعریف نشده")
                    voucherLines += VoucherLineEntity(voucherId = voucherId, accountId = cogsAccount.id, debitRial = cogs, creditRial = 0, description = "بهای تمام‌شده فروش")
                    voucherLines += VoucherLineEntity(voucherId = voucherId, accountId = inventoryAccount.id, debitRial = 0, creditRial = cogs, description = "خروج بهای کالا از انبار")
                }
            }
            db.voucherLineDao().insertAll(voucherLines)
            db.partyLedgerDao().insert(PartyLedgerEntity(partyId = partyId, debitRial = if (kind == "SALE") total else 0, creditRial = if (kind == "PURCHASE") total else 0, description = if (kind == "SALE") "فاکتور فروش " + number else "فاکتور خرید " + number, referenceId = invoiceId))
        }
    }
    suspend fun reverseInvoice(invoiceId: Long) {
        db.withTransaction {
            ensureBaseAccounts()
            val invoice = db.invoiceDao().getById(invoiceId) ?: error("فاکتور پیدا نشد")
            require(invoice.status == "POSTED") { "فقط فاکتور ثبت‌شده قابل برگشت است" }
            val lines = db.invoiceLineDao().byInvoice(invoiceId)
            require(lines.isNotEmpty()) { "ردیف‌های فاکتور برای برگشت پیدا نشد" }
            var purchaseReversalInventoryCost = 0L
            lines.forEach { line ->
                val stored = db.productValuationDao().get(line.productId)
                val current = stored?.let { InventoryValuation(it.quantityKg, it.valueRial) }
                    ?: InventoryValuation(0.0, 0L)
                val next = if (invoice.kind == "SALE") {
                    require(line.inventoryCostRial > 0) {
                        "این فاکتور قبل از ثبت بهای تمام‌شده صادر شده و برگشت خودکار ارزش موجودی آن امن نیست"
                    }
                    InventoryValuationEngine.receive(current, line.quantityKg, line.inventoryCostRial)
                } else {
                    require(stored != null && current.quantityKg + 0.000001 >= line.quantityKg) {
                        "موجودی کافی برای برگشت خرید وجود ندارد"
                    }
                    val issue = InventoryValuationEngine.issue(current, line.quantityKg)
                    purchaseReversalInventoryCost = Math.addExact(purchaseReversalInventoryCost, issue.cogsRial)
                    issue.remaining
                }
                db.productValuationDao().upsert(ProductValuationEntity(line.productId, next.quantityKg, next.valueRial))
                db.stockDao().insert(
                    StockMovementEntity(
                        productId = line.productId,
                        quantityKg = if (invoice.kind == "SALE") line.quantityKg else -line.quantityKg,
                        kind = "REVERSAL",
                        referenceId = invoiceId,
                        note = "برگشت ${invoice.number}"
                    )
                )
            }
            db.partyLedgerDao().insert(
                PartyLedgerEntity(
                    partyId = invoice.partyId,
                    debitRial = if (invoice.kind == "PURCHASE") invoice.totalRial else 0,
                    creditRial = if (invoice.kind == "SALE") invoice.totalRial else 0,
                    description = "برگشت فاکتور ${invoice.number}",
                    referenceId = invoiceId
                )
            )
            require(db.voucherDao().byReference("REVERSAL:$invoiceId") == null) {
                "برای این فاکتور قبلاً سند برگشت ثبت شده است"
            }
            val originalVoucher = db.voucherDao().byReference("INVOICE:$invoiceId")
                ?: error("سند حسابداری اصلی فاکتور پیدا نشد؛ برگشت امن ممکن نیست")
            val oldLines = db.voucherLineDao().byVoucher(originalVoucher.id)
            require(oldLines.size >= 2) { "ردیف‌های سند اصلی ناقص است؛ برگشت امن ممکن نیست" }
            AccountingEngine.requireBalanced(
                oldLines.map { VoucherLineDraft("0", debitRial = it.debitRial, creditRial = it.creditRial) }
            )
            val reverseId = db.voucherDao().insert(
                VoucherEntity(
                    number = "R-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(8)}",
                    description = "سند برگشت ${invoice.number}",
                    reference = "REVERSAL:$invoiceId"
                )
            )
            val reversalVoucherLines = oldLines.map {
                VoucherLineEntity(
                    voucherId = reverseId,
                    accountId = it.accountId,
                    debitRial = it.creditRial,
                    creditRial = it.debitRial,
                    description = "برگشت سند"
                )
            }.toMutableList()
            if (invoice.kind == "PURCHASE") {
                val inventoryAccount = db.accountDao().byCode("1301")
                    ?: error("حساب موجودی کالا تعریف نشده است")
                val varianceAccount = db.accountDao().byCode("5202")
                    ?: error("حساب اختلاف بهای برگشت خرید تعریف نشده است")
                val originalInventoryDebit = oldLines
                    .filter { it.accountId == inventoryAccount.id }
                    .fold(0L) { total, line -> Math.addExact(total, line.debitRial) }
                AccountingEngine.purchaseReversalAdjustment(
                    actualInventoryCostRial = purchaseReversalInventoryCost,
                    originalInventoryDebitRial = originalInventoryDebit
                ).forEach { adjustment ->
                    val accountId = when (adjustment.accountCode) {
                        "1301" -> inventoryAccount.id
                        "5202" -> varianceAccount.id
                        else -> error("حساب تعدیل برگشت خرید ناشناخته است")
                    }
                    reversalVoucherLines += VoucherLineEntity(
                        voucherId = reverseId,
                        accountId = accountId,
                        debitRial = adjustment.debitRial,
                        creditRial = adjustment.creditRial,
                        description = if (adjustment.accountCode == "1301")
                            "تعدیل بهای خروج موجودی در برگشت خرید"
                        else "اختلاف بهای برگشت خرید"
                    )
                }
            }
            db.voucherLineDao().insertAll(reversalVoucherLines)
            db.invoiceDao().update(invoice.copy(status = "REVERSED"))
        }
    }

    suspend fun saveAccount(code: String, title: String, type: String) {
        val normalizedCode = code.trim()
        require(normalizedCode.matches(Regex("[0-9]{3,12}"))) { "کد حساب باید ۳ تا ۱۲ رقم باشد" }
        require(title.isNotBlank()) { "عنوان حساب الزامی است" }
        require(type in setOf("ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE")) { "گروه حساب معتبر نیست" }
        val existing = db.accountDao().byCode(normalizedCode)
        if (existing == null) {
            db.accountDao().insertIgnore(AccountEntity(code = normalizedCode, title = title.trim(), type = type))
        } else {
            db.accountDao().update(existing.copy(title = title.trim(), type = type))
        }
    }

    suspend fun updateOpeningBalances(values: Map<String, Pair<Long, Long>>) {
        require(values.isNotEmpty()) { "مانده افتتاحیه‌ای برای ثبت وجود ندارد" }
        require(values.values.all { (debit, credit) -> debit >= 0 && credit >= 0 && !(debit > 0 && credit > 0) }) {
            "هر حساب باید مانده بدهکار یا بستانکار داشته باشد، نه هر دو"
        }
        val debitTotal = values.values.fold(java.math.BigInteger.ZERO) { total, value -> total + java.math.BigInteger.valueOf(value.first) }
        val creditTotal = values.values.fold(java.math.BigInteger.ZERO) { total, value -> total + java.math.BigInteger.valueOf(value.second) }
        require(debitTotal.signum() > 0 && debitTotal == creditTotal) { "جمع مانده افتتاحیه بدهکار و بستانکار باید برابر و بیشتر از صفر باشد" }
        db.withTransaction {
            values.forEach { (code, amount) ->
                val account = db.accountDao().byCode(code) ?: error("حساب $code پیدا نشد")
                db.accountDao().update(account.copy(openingDebitRial = amount.first, openingCreditRial = amount.second))
            }
        }
    }

    suspend fun reverseManualVoucher(number: String) {
        db.withTransaction {
            val original = db.voucherDao().byNumber(number) ?: error("سند پیدا نشد")
            require(original.reference.startsWith("MANUAL:")) { "فقط سند دستی قابل برگشت است" }
            require(db.voucherDao().byReference("REVERSAL:VOUCHER:${original.id}") == null) { "این سند قبلاً برگشت داده شده است" }
            val lines = db.voucherLineDao().byVoucher(original.id)
            require(lines.size >= 2) { "ردیف‌های سند پیدا نشد" }
            val reversalId = db.voucherDao().insert(VoucherEntity(number = "REV-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(6)}", description = "برگشت سند ${original.number}", reference = "REVERSAL:VOUCHER:${original.id}"))
            db.voucherLineDao().insertAll(lines.map { line -> VoucherLineEntity(voucherId = reversalId, accountId = line.accountId, debitRial = line.creditRial, creditRial = line.debitRial, description = "برگشت سند ${original.number}") })
        }
    }
    suspend fun addManualVoucher(description: String, drafts: List<VoucherLineDraft>) {
        require(description.isNotBlank()) { "شرح سند الزامی است" }
        require(drafts.size >= 2) { "سند باید حداقل دو ردیف داشته باشد" }
        require(drafts.all { it.accountCode.isNotBlank() }) { "حساب همه ردیف‌ها را انتخاب کنید" }
        AccountingEngine.requireBalanced(drafts)
        db.withTransaction {
            ensureBaseAccounts()
            val resolved = drafts.map { draft ->
                val account = db.accountDao().byCode(draft.accountCode.trim())
                    ?: error("حساب ${draft.accountCode} پیدا نشد")
                account to draft
            }
            require(resolved.map { it.first.id }.distinct().size >= 2) { "حداقل دو حساب متفاوت لازم است" }
            val number = "MAN-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(6)}"
            val voucherId = db.voucherDao().insert(
                VoucherEntity(number = number, description = description.trim(), reference = "MANUAL:$number")
            )
            db.voucherLineDao().insertAll(resolved.map { (account, draft) ->
                VoucherLineEntity(
                    voucherId = voucherId,
                    accountId = account.id,
                    debitRial = draft.debitRial,
                    creditRial = draft.creditRial,
                    description = description.trim()
                )
            })
        }
    }

    suspend fun addTreasuryEntry(
        kind: String, method: String, partyId: Long, amountRial: Long,
        referenceNumber: String, note: String
    ) {
        require(kind == "RECEIPT" || kind == "PAYMENT")
        require(method == "CASH" || method == "BANK")
        require(amountRial > 0) { "مبلغ باید بیشتر از صفر باشد" }
        db.withTransaction {
            val party = db.partyDao().getById(partyId) ?: error("طرف حساب پیدا نشد")
            if (kind == "RECEIPT") require(party.kind != "SUPPLIER") { "برای دریافت، مشتری انتخاب کنید" }
            else require(party.kind != "CUSTOMER") { "برای پرداخت، تأمین‌کننده انتخاب کنید" }
            ensureBaseAccounts()
            val drafts = AccountingEngine.treasuryVoucherLines(kind, method, amountRial)
            val accountLines = drafts.map { draft ->
                val account = db.accountDao().byCode(draft.accountCode) ?: error("حساب ${draft.accountCode} تعریف نشده")
                account to draft
            }
            val entryId = db.treasuryDao().insert(
                TreasuryEntryEntity(
                    kind = kind, method = method, partyId = partyId,
                    amountRial = amountRial, referenceNumber = referenceNumber.trim(), note = note.trim()
                )
            )
            val voucherId = db.voucherDao().insert(
                VoucherEntity(
                    number = "T-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(8)}",
                    description = if (kind == "RECEIPT") "دریافت از ${party.name}" else "پرداخت به ${party.name}",
                    reference = "TREASURY:$entryId"
                )
            )
            db.voucherLineDao().insertAll(
                accountLines.map { (account, draft) ->
                    VoucherLineEntity(
                        voucherId = voucherId, accountId = account.id,
                        debitRial = draft.debitRial, creditRial = draft.creditRial,
                        description = if (method == "CASH") "صندوق" else "بانک"
                    )
                }
            )
            db.partyLedgerDao().insert(
                PartyLedgerEntity(
                    partyId = partyId,
                    debitRial = if (kind == "PAYMENT") amountRial else 0,
                    creditRial = if (kind == "RECEIPT") amountRial else 0,
                    description = if (kind == "RECEIPT") "رسید دریافت" else "حواله پرداخت",
                    referenceId = entryId
                )
            )
        }
    }

    suspend fun addCheck(
        checkNumber: String, kind: String, partyId: Long, amountRial: Long,
        issueDateEpoch: Long, dueDateEpoch: Long, bankName: String, note: String
    ) {
        val normalized = checkNumber.trim()
        require(normalized.isNotBlank()) { "شماره چک الزامی است" }
        require(kind == "RECEIVED" || kind == "PAYABLE") { "نوع چک نامعتبر است" }
        require(amountRial > 0) { "مبلغ چک باید بیشتر از صفر باشد" }
        require(dueDateEpoch >= issueDateEpoch) { "سررسید نمی‌تواند قبل از تاریخ صدور باشد" }
        db.withTransaction {
            val party = db.partyDao().getById(partyId) ?: error("طرف حساب پیدا نشد")
            if (kind == "RECEIVED") require(party.kind != "SUPPLIER") { "برای چک دریافتی مشتری انتخاب کنید" }
            else require(party.kind != "CUSTOMER") { "برای چک پرداختی تأمین‌کننده انتخاب کنید" }
            ensureBaseAccounts()
            val checkId = db.checkDao().insert(CheckEntity(
                checkNumber = normalized, kind = kind, partyId = partyId, amountRial = amountRial,
                issueDateEpoch = issueDateEpoch, dueDateEpoch = dueDateEpoch, bankName = bankName.trim(), note = note.trim()
            ))
            postCheckVoucher(checkId, "ISSUE",
                if (kind == "RECEIVED") "دریافت چک از ${party.name}" else "صدور چک برای ${party.name}",
                AccountingEngine.checkVoucherLines(kind, "ISSUE", amountRial))
            db.partyLedgerDao().insert(PartyLedgerEntity(
                partyId = partyId,
                debitRial = if (kind == "PAYABLE") amountRial else 0,
                creditRial = if (kind == "RECEIVED") amountRial else 0,
                description = if (kind == "RECEIVED") "دریافت چک شماره $normalized" else "صدور چک شماره $normalized",
                referenceId = checkId
            ))
        }
    }

    suspend fun updateCheckStatus(id: Long, status: String) {
        require(status in setOf("OPEN", "CLEARED", "BOUNCED", "CANCELLED")) { "وضعیت چک نامعتبر است" }
        db.withTransaction {
            val check = db.checkDao().getById(id) ?: error("چک پیدا نشد")
            require(check.status == "OPEN") { "وضعیت این چک قبلاً نهایی شده است" }
            ensureBaseAccounts()
            // Older databases may contain checks saved before check accounting was introduced.
            // Establish their original posting before recording the final status transition.
            if (db.voucherDao().byReference("CHECK:$id:ISSUE") == null) {
                postCheckVoucher(
                    id, "ISSUE",
                    if (check.kind == "RECEIVED") "دریافت چک از طرف حساب" else "صدور چک برای طرف حساب",
                    AccountingEngine.checkVoucherLines(check.kind, "ISSUE", check.amountRial)
                )
                db.partyLedgerDao().insert(PartyLedgerEntity(
                    partyId = check.partyId,
                    debitRial = if (check.kind == "PAYABLE") check.amountRial else 0,
                    creditRial = if (check.kind == "RECEIVED") check.amountRial else 0,
                    description = "ثبت اولیه حسابداری چک شماره ${check.checkNumber}",
                    referenceId = id
                ))
            }
            when (status) {
                "CLEARED" -> postCheckVoucher(id, "CLEARED", "تسویه چک شماره ${check.checkNumber}",
                    AccountingEngine.checkVoucherLines(check.kind, "CLEARED", check.amountRial))
                "BOUNCED", "CANCELLED" -> {
                    postCheckVoucher(id, "RETURNED",
                        if (status == "BOUNCED") "برگشت چک شماره ${check.checkNumber}" else "ابطال چک شماره ${check.checkNumber}",
                        AccountingEngine.checkVoucherLines(check.kind, "RETURNED", check.amountRial))
                    db.partyLedgerDao().insert(PartyLedgerEntity(
                        partyId = check.partyId,
                        debitRial = if (check.kind == "RECEIVED") check.amountRial else 0,
                        creditRial = if (check.kind == "PAYABLE") check.amountRial else 0,
                        description = if (status == "BOUNCED") "برگشت چک شماره ${check.checkNumber}" else "ابطال چک شماره ${check.checkNumber}",
                        referenceId = id
                    ))
                }
            }
            db.checkDao().update(check.copy(status = status))
        }
    }

    private suspend fun postCheckVoucher(checkId: Long, event: String, description: String, drafts: List<VoucherLineDraft>) {
        val reference = "CHECK:$checkId:$event"
        require(db.voucherDao().byReference(reference) == null) { "سند این عملیات چک قبلاً ثبت شده است" }
        AccountingEngine.requireBalanced(drafts)
        val resolved = drafts.map { draft ->
            val account = db.accountDao().byCode(draft.accountCode) ?: error("حساب ${draft.accountCode} تعریف نشده")
            account to draft
        }
        val voucherId = db.voucherDao().insert(VoucherEntity(
            number = "CH-$checkId-$event-${UUID.randomUUID().toString().take(6)}",
            description = description, reference = reference
        ))
        db.voucherLineDao().insertAll(resolved.map { (account, draft) ->
            VoucherLineEntity(voucherId = voucherId, accountId = account.id,
                debitRial = draft.debitRial, creditRial = draft.creditRial, description = description)
        })
    }

    suspend fun addImportOrder(
        supplierId: Long, currency: String, fxRateToRial: Long, containerCode: String,
        grossWeightKg: Double, goodsAmountMinor: Long, freightRial: Long,
        customsRial: Long, otherCostsRial: Long, creditDays: Int
    ) {
        val normalizedContainer = containerCode.trim().uppercase(Locale.ROOT)
        require(currency in setOf("USD", "CNY", "IRR")) { "ارز انتخاب‌شده معتبر نیست" }
        require(fxRateToRial > 0) { "نرخ ارز باید بیشتر از صفر باشد" }
        require(grossWeightKg > 0.0 && grossWeightKg.isFinite()) { "وزن کانتینر باید مثبت و معتبر باشد" }
        require(goodsAmountMinor > 0) { "مبلغ کالا باید بیشتر از صفر باشد" }
        require(freightRial >= 0 && customsRial >= 0 && otherCostsRial >= 0) { "هزینه‌ها نمی‌توانند منفی باشند" }
        require(creditDays in 0..3650) { "مهلت تسویه خارج از محدوده مجاز است" }
        require(normalizedContainer.isNotBlank()) { "شماره کانتینر الزامی است" }
        val effectiveRate = if (currency == "IRR") 1L else fxRateToRial
        val total = LandedCostCalculator.totalCostRial(
            goodsAmountMinor, effectiveRate, freightRial, customsRial, otherCostsRial
        )
        require(total > 0) { "بهای تمام‌شده باید بیشتر از صفر باشد" }
        db.withTransaction {
            val supplier = db.partyDao().getById(supplierId) ?: error("تأمین‌کننده پیدا نشد")
            require(supplier.kind != "CUSTOMER") { "طرف حساب انتخاب‌شده تأمین‌کننده نیست" }
            require(db.importOrderDao().byContainerCode(normalizedContainer) == null) {
                "این شماره کانتینر قبلاً ثبت شده است"
            }
            val now = System.currentTimeMillis()
            val dueAt = Math.addExact(now, Math.multiplyExact(creditDays.toLong(), 86_400_000L))
            db.importOrderDao().insert(
                ImportOrderEntity(
                    supplierId = supplierId,
                    currency = currency,
                    fxRateToRial = effectiveRate,
                    containerCode = normalizedContainer,
                    orderedAt = now,
                    grossWeightKg = grossWeightKg,
                    goodsAmountMinor = goodsAmountMinor,
                    freightRial = freightRial,
                    customsRial = customsRial,
                    otherCostsRial = otherCostsRial,
                    supplierDueAt = dueAt
                )
            )
        }
    }


    suspend fun receiveImport(orderId: Long, lines: List<ImportReceiptLineInput>) {
        val quantities = AccountingEngine.aggregateQuantities(lines.map { it.productId to it.quantityKg })
        db.withTransaction {
            val order = db.importOrderDao().getById(orderId) ?: error("سفارش واردات پیدا نشد")
            require(order.status != "RECEIVED") { "این محموله قبلاً رسید شده است" }
            require(db.importReceiptDao().byOrder(orderId) == null) { "برای این سفارش قبلاً رسید انبار صادر شده است" }
            val totalKg = quantities.values.fold(0.0) { sum, value ->
                val next = sum + value
                require(next.isFinite()) { "مجموع وزن خارج از محدوده مجاز است" }
                next
            }
            require(kotlin.math.abs(totalKg - order.grossWeightKg) <= 0.001) {
                "جمع وزن ردیف‌ها باید با وزن سفارش (" + order.grossWeightKg + " کیلوگرم) برابر باشد"
            }
            quantities.keys.forEach { productId ->
                require(db.productDao().getById(productId) != null) { "یکی از کالاهای انتخاب‌شده وجود ندارد" }
            }
            val goodsCost = Math.multiplyExact(order.goodsAmountMinor, order.fxRateToRial)
            val landedTotal = LandedCostCalculator.totalCostRial(
                order.goodsAmountMinor, order.fxRateToRial, order.freightRial, order.customsRial, order.otherCostsRial
            )
            val receiptId = db.importReceiptDao().insert(
                ImportReceiptEntity(importOrderId = orderId, goodsCostRial = goodsCost, totalCostRial = landedTotal)
            )
            val costAllocations = AccountingEngine.allocateLandedCost(landedTotal, quantities.entries.map { it.key to it.value })
            val receiptLines = quantities.entries.map { entry ->
                ImportReceiptLineEntity(
                    receiptId = receiptId, productId = entry.key, quantityKg = entry.value,
                    allocatedCostRial = costAllocations[entry.key] ?: error("تخصیص بهای تمام‌شده ناموفق بود")
                )
            }
            db.importReceiptDao().insertLines(receiptLines)
            receiptLines.forEach { line ->
                val oldValuation = db.productValuationDao().get(line.productId)
                val currentValuation = oldValuation?.let { InventoryValuation(it.quantityKg, it.valueRial) } ?: InventoryValuation(0.0, 0L)
                val nextValuation = InventoryValuationEngine.receive(currentValuation, line.quantityKg, line.allocatedCostRial)
                db.productValuationDao().upsert(ProductValuationEntity(line.productId, nextValuation.quantityKg, nextValuation.valueRial))
                db.stockDao().insert(StockMovementEntity(
                    productId = line.productId, quantityKg = line.quantityKg,
                    kind = "IMPORT_RECEIPT", referenceId = receiptId,
                    note = "رسید محموله " + order.containerCode
                ))
            }
            ensureBaseAccounts()
            val additionalCosts = Math.subtractExact(landedTotal, goodsCost)
            val drafts = buildList {
                add(VoucherLineDraft("1301", debitRial = landedTotal))
                add(VoucherLineDraft("2101", creditRial = goodsCost))
                if (additionalCosts > 0) add(VoucherLineDraft("2102", creditRial = additionalCosts))
            }
            AccountingEngine.requireBalanced(drafts)
            val accountLines = drafts.map { draft ->
                (db.accountDao().byCode(draft.accountCode) ?: error("حساب " + draft.accountCode + " تعریف نشده")) to draft
            }
            val voucherId = db.voucherDao().insert(VoucherEntity(
                number = "IMP-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().take(8),
                description = "رسید و ورود انبار محموله " + order.containerCode,
                reference = "IMPORT_RECEIPT:" + receiptId
            ))
            db.voucherLineDao().insertAll(accountLines.map { (account, draft) ->
                VoucherLineEntity(
                    voucherId = voucherId, accountId = account.id,
                    debitRial = draft.debitRial, creditRial = draft.creditRial,
                    description = "محموله " + order.containerCode
                )
            })
            db.partyLedgerDao().insert(PartyLedgerEntity(
                partyId = order.supplierId, debitRial = 0, creditRial = goodsCost,
                description = "ثبت بدهی کالای وارداتی کانتینر " + order.containerCode,
                referenceId = receiptId
            ))
            db.importOrderDao().update(order.copy(status = "RECEIVED", arrivedAt = System.currentTimeMillis()))
        }
    }

    suspend fun loadDemoData() {
        db.withTransaction {
            require(db.productDao().countBySkuPattern("DEMO-%") == 0) { "داده‌های آزمایشی قبلاً اضافه شده‌اند" }
            val supplierId = db.partyDao().insert(PartyEntity(name = "بازرگانی نخ شرق (آزمایشی)", kind = "SUPPLIER", phone = "021-55502020", address = "تهران - نمونه"))
            val customerId = db.partyDao().insert(PartyEntity(name = "شرکت نساجی نمونه آریا", kind = "CUSTOMER", phone = "021-55501010", address = "تهران - نمونه"))
            val p1 = db.productDao().insert(ProductEntity(sku = "DEMO-FDY-75-W", name = "نخ FDY سفید 75D (آزمایشی)", groupName = "پلی‌استر", yarnType = "FDY", color = "سفید", denier = 75, twisted = false, notes = "داده آزمایشی"))
            val p2 = db.productDao().insert(ProductEntity(sku = "DEMO-FDY-75-B", name = "نخ FDY مشکی 75D (آزمایشی)", groupName = "پلی‌استر", yarnType = "FDY", color = "مشکی", denier = 75, twisted = false, notes = "داده آزمایشی"))
            val p3 = db.productDao().insert(ProductEntity(sku = "DEMO-DTY-150-W", name = "نخ DTY سفید 150D (آزمایشی)", groupName = "پلی‌استر", yarnType = "DTY", color = "سفید", denier = 150, twisted = true, notes = "داده آزمایشی"))
            createAndPostMultiLineInvoice("PURCHASE", supplierId, listOf(
                InvoiceLineInput(p1, 500.0, 1_200_000),
                InvoiceLineInput(p2, 300.0, 1_300_000),
                InvoiceLineInput(p3, 200.0, 1_500_000)
            ), 0, 0)
            createAndPostMultiLineInvoice("SALE", customerId, listOf(
                InvoiceLineInput(p1, 25.0, 1_650_000),
                InvoiceLineInput(p2, 15.0, 1_750_000)
            ), 1_000_000, 0)
        }
    }

    private suspend fun ensureBaseAccounts() {
        val accounts = listOf(
            AccountEntity(code = "1101", title = "صندوق", type = "ASSET"),
            AccountEntity(code = "1102", title = "بانک", type = "ASSET"),
            AccountEntity(code = "1103", title = "حساب‌های دریافتنی", type = "ASSET"),
            AccountEntity(code = "1104", title = "اسناد دریافتنی", type = "ASSET"),
            AccountEntity(code = "1301", title = "موجودی کالا", type = "ASSET"),
            AccountEntity(code = "2101", title = "حساب‌های پرداختنی تأمین‌کنندگان", type = "LIABILITY"),
            AccountEntity(code = "2102", title = "هزینه‌های حمل و گمرک پرداختنی", type = "LIABILITY"),
            AccountEntity(code = "2103", title = "مالیات بر ارزش افزوده فروش", type = "LIABILITY"),
            AccountEntity(code = "2104", title = "اسناد پرداختنی", type = "LIABILITY"),
            AccountEntity(code = "4101", title = "فروش کالا", type = "REVENUE"),
            AccountEntity(code = "5101", title = "بهای تمام‌شده کالای فروش‌رفته", type = "EXPENSE"),
            AccountEntity(code = "4201", title = "مازاد و افزایش موجودی انبار", type = "REVENUE"),
            AccountEntity(code = "5201", title = "کسری و کاهش موجودی انبار", type = "EXPENSE"),
            AccountEntity(code = "5202", title = "اختلاف بهای برگشت خرید", type = "EXPENSE")
        )
        accounts.forEach { db.accountDao().insertIgnore(it) }
    }
}
