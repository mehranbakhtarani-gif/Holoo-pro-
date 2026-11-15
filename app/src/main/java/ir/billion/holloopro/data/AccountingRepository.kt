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
    val warehouses = db.warehouseDao().observeAll()
    val warehouseStocks = db.warehouseStockDao().observeStocks()
    val warehouseKardex = db.warehouseStockDao().observeKardex()
    val parties = db.partyDao().observeAll()
    val partyBalances = db.partyDao().observeBalances()
    fun partyLedger(partyId: Long) = db.partyLedgerDao().observeForParty(partyId)
    val suppliers = db.partyDao().observeSuppliers()
    val invoices = db.invoiceDao().observeAll()
    val invoiceSettlements = db.invoiceDao().observeSettlementTotals()
    val returnableInvoiceLines = db.invoiceReturnDao().observeReturnableLines()
    val invoiceReturnTotals = db.invoiceReturnDao().observeTotals()
    val settlementDetails = db.invoiceSettlementDao().observeDetails()
    val treasuryAllocations = db.invoiceSettlementDao().observeTreasuryAllocations()
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
    val bankStatements = db.bankStatementDao().observeAll()
    val bankStatementPeriods = db.bankStatementPeriodDao().observeAll()
    val profitLoss = db.invoiceDao().observeProfitLoss()
    val productProfitability = db.productDao().observeProfitability()
    val invoiceProfitability = db.invoiceDao().observeInvoiceProfitability()


    private suspend fun syncGlobalValuation(productId: Long) {
        val aggregate = db.warehouseStockDao().aggregateValuation(productId)
        db.productValuationDao().upsert(
            ProductValuationEntity(productId, aggregate.quantityKg, aggregate.valueRial)
        )
    }

    suspend fun createWarehouse(name: String, address: String = "") {
        require(name.isNotBlank()) { "نام انبار الزامی است" }
        db.warehouseDao().insert(WarehouseEntity(name = name.trim(), address = address.trim()))
    }

    suspend fun transferStock(productId: Long, sourceWarehouseId: Long, targetWarehouseId: Long, quantityKg: Double) {
        require(sourceWarehouseId != targetWarehouseId) { "انبار مبدأ و مقصد باید متفاوت باشند" }
        require(quantityKg.isFinite() && quantityKg > 0.000001) { "مقدار انتقال باید مثبت باشد" }
        db.withTransaction {
            val product = db.productDao().getById(productId) ?: error("کالا پیدا نشد")
            db.warehouseDao().getById(sourceWarehouseId) ?: error("انبار مبدأ پیدا نشد")
            db.warehouseDao().getById(targetWarehouseId) ?: error("انبار مقصد پیدا نشد")
            val sourceStock = db.warehouseStockDao().stockForProduct(sourceWarehouseId, productId)
            require(sourceStock + 0.000001 >= quantityKg) { "موجودی انبار مبدأ برای انتقال کافی نیست" }
            val sourceStored = db.warehouseStockDao().valuation(sourceWarehouseId, productId)
                ?: error("بهای موجودی کالا در انبار مبدأ مشخص نیست")
            val issue = InventoryValuationEngine.issue(
                InventoryValuation(sourceStored.quantityKg, sourceStored.valueRial), quantityKg
            )
            val targetStored = db.warehouseStockDao().valuation(targetWarehouseId, productId)
            val targetCurrent = targetStored?.let { InventoryValuation(it.quantityKg, it.valueRial) }
                ?: InventoryValuation(0.0, 0L)
            val targetNext = InventoryValuationEngine.receive(targetCurrent, quantityKg, issue.cogsRial)
            db.warehouseStockDao().upsertValuation(
                sourceStored.copy(quantityKg = issue.remaining.quantityKg, valueRial = issue.remaining.valueRial, updatedAt = System.currentTimeMillis())
            )
            db.warehouseStockDao().upsertValuation(
                WarehouseValuationEntity(targetWarehouseId, productId, targetNext.quantityKg, targetNext.valueRial)
            )
            val transferRef = System.currentTimeMillis()
            db.warehouseStockDao().insertMovement(
                WarehouseStockMovementEntity(warehouseId = sourceWarehouseId, productId = productId, quantityKg = -quantityKg, kind = "TRANSFER_OUT", referenceId = transferRef, note = "انتقال به انبار دیگر")
            )
            db.warehouseStockDao().insertMovement(
                WarehouseStockMovementEntity(warehouseId = targetWarehouseId, productId = productId, quantityKg = quantityKg, kind = "TRANSFER_IN", referenceId = transferRef, note = "انتقال از انبار دیگر")
            )
            syncGlobalValuation(productId)
        }
    }

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


    suspend fun setOpeningInventoryValuation(productId: Long, costPerKgRial: Long, warehouseId: Long = 1L) {
        require(costPerKgRial > 0) { "بهای هر کیلو باید بیشتر از صفر باشد" }
        db.withTransaction {
            db.productDao().getById(productId) ?: error("کالا پیدا نشد")
            db.warehouseDao().getById(warehouseId) ?: error("انبار پیدا نشد")
            val stock = db.warehouseStockDao().stockForProduct(warehouseId, productId)
            require(stock.isFinite() && stock > 0.000001) { "برای این کالا در انبار انتخاب‌شده موجودی مثبت ثبت نشده است" }
            require(db.warehouseStockDao().valuation(warehouseId, productId) == null) { "ارزش موجودی این کالا در این انبار قبلاً ثبت شده است" }
            val value = BigDecimal.valueOf(stock).multiply(BigDecimal.valueOf(costPerKgRial))
                .setScale(0, java.math.RoundingMode.HALF_UP).longValueExact()
            require(value > 0) { "ارزش موجودی باید بیشتر از صفر باشد" }
            db.warehouseStockDao().upsertValuation(WarehouseValuationEntity(warehouseId, productId, stock, value))
            syncGlobalValuation(productId)
        }
    }

    suspend fun adjustStock(productId: Long, deltaKg: Double, costPerKgRial: Long, warehouseId: Long = 1L) {
        require(deltaKg.isFinite() && kotlin.math.abs(deltaKg) > 0.000001) { "مقدار اصلاح موجودی نباید صفر باشد" }
        require(costPerKgRial >= 0) { "بهای هر کیلو معتبر نیست" }
        db.withTransaction {
            val product = db.productDao().getById(productId) ?: error("کالا پیدا نشد")
            db.warehouseDao().getById(warehouseId) ?: error("انبار پیدا نشد")
            val stock = db.warehouseStockDao().stockForProduct(warehouseId, productId)
            val stored = db.warehouseStockDao().valuation(warehouseId, productId)
            if (stored == null && stock > 0.000001) {
                error("ابتدا بهای افتتاحیه موجودی این کالا را در انبار انتخاب‌شده ثبت کنید")
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
            db.warehouseStockDao().upsertValuation(
                WarehouseValuationEntity(warehouseId, productId, next.quantityKg, next.valueRial)
            )
            syncGlobalValuation(productId)
            db.stockDao().insert(
                StockMovementEntity(productId = productId, quantityKg = deltaKg, kind = "STOCKTAKE_ADJUSTMENT", note = "اصلاح موجودی انبار: ${product.name}")
            )
            db.warehouseStockDao().insertMovement(
                WarehouseStockMovementEntity(warehouseId = warehouseId, productId = productId, quantityKg = deltaKg, kind = "STOCKTAKE_ADJUSTMENT", note = "اصلاح موجودی انبار: ${product.name}")
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
        unitPriceRial: Long, discountRial: Long, taxRial: Long, extraCostsRial: Long = 0, warehouseId: Long = 1L
    ) = createAndPostMultiLineInvoice(
        kind, partyId, listOf(InvoiceLineInput(productId, quantityKg, unitPriceRial)),
        discountRial, taxRial, extraCostsRial, warehouseId
    )

    suspend fun createAndPostMultiLineInvoice(kind: String, partyId: Long, lines: List<InvoiceLineInput>, discountRial: Long, taxRial: Long, extraCostsRial: Long = 0, warehouseId: Long = 1L) {
        require(kind == "SALE" || kind == "PURCHASE")
        require(lines.isNotEmpty()) { "فاکتور باید حداقل یک ردیف کالا داشته باشد" }
        require(discountRial >= 0 && taxRial >= 0 && extraCostsRial >= 0)
        require(kind == "PURCHASE" || extraCostsRial == 0L) { "هزینه جانبی فقط برای خرید قابل ثبت است" }
        lines.forEach { require(it.quantityKg > 0 && it.quantityKg.isFinite() && it.unitPriceRial > 0) { "مقدار و قیمت هر ردیف باید مثبت باشد" } }
        val amounts = lines.map { line -> BigDecimal.valueOf(line.quantityKg).multiply(BigDecimal.valueOf(line.unitPriceRial)).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact() }
        val subtotal = amounts.fold(0L) { sum, amount -> Math.addExact(sum, amount) }
        require(discountRial <= subtotal) { "تخفیف از مبلغ کالا بیشتر است" }
        val netGoods = Math.subtractExact(subtotal, discountRial)
        require(netGoods > 0) { "مبلغ خالص کالا پس از تخفیف باید بیشتر از صفر باشد" }
        val total = Math.addExact(Math.addExact(netGoods, taxRial), extraCostsRial)
        require(total > 0) { "مبلغ فاکتور باید بیشتر از صفر باشد" }
        db.withTransaction {
            val party = db.partyDao().getById(partyId) ?: error("طرف حساب پیدا نشد")
            db.warehouseDao().getById(warehouseId) ?: error("انبار انتخاب‌شده پیدا نشد")
            if (kind == "SALE") require(party.kind != "SUPPLIER") { "برای فروش، مشتری انتخاب کنید" } else require(party.kind != "CUSTOMER") { "برای خرید، تأمین‌کننده انتخاب کنید" }
            val requestedByProduct = AccountingEngine.aggregateQuantities(lines.map { it.productId to it.quantityKg })
            if (kind == "SALE") {
                requestedByProduct.forEach { (productId, requestedKg) ->
                    val product = db.productDao().getById(productId) ?: error("یکی از کالاهای فاکتور پیدا نشد")
                    val available = db.warehouseStockDao().stockForProduct(warehouseId, productId)
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
                val existing = db.warehouseStockDao().valuation(warehouseId, line.productId)
                if (existing == null && db.warehouseStockDao().stockForProduct(warehouseId, line.productId) > 0.000001) {
                    error("ابتدا بهای افتتاحیه موجودی کالا را در انبار انتخاب‌شده ثبت کنید")
                }
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
                db.warehouseStockDao().upsertValuation(WarehouseValuationEntity(warehouseId, line.productId, next.quantityKg, next.valueRial))
                syncGlobalValuation(line.productId)
            }
            val number = "HP-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().take(8)
            val invoiceId = db.invoiceDao().insert(InvoiceEntity(number = number, kind = kind, partyId = partyId, subtotalRial = subtotal, discountRial = discountRial, taxRial = taxRial, totalRial = total, status = "POSTED", extraCostsRial = extraCostsRial, warehouseId = warehouseId))
            db.invoiceLineDao().insertAll(resolved.mapIndexed { index, (line, _, amount) -> InvoiceLineEntity(invoiceId = invoiceId, productId = line.productId, quantityKg = line.quantityKg, unitPriceRial = line.unitPriceRial, lineTotalRial = amount, inventoryCostRial = inventoryCosts[index]) })
            resolved.forEach { (line, _, _) ->
                val movementQuantity = if (kind == "SALE") -line.quantityKg else line.quantityKg
                val movementKind = if (kind == "SALE") "SALE" else "PURCHASE"
                db.stockDao().insert(StockMovementEntity(productId = line.productId, quantityKg = movementQuantity, kind = movementKind, referenceId = invoiceId, note = number))
                db.warehouseStockDao().insertMovement(WarehouseStockMovementEntity(warehouseId = warehouseId, productId = line.productId, quantityKg = movementQuantity, kind = movementKind, referenceId = invoiceId, note = number))
            }
            ensureBaseAccounts()
            val drafts = AccountingEngine.invoicePostingLines(kind, subtotal, discountRial, taxRial, extraCostsRial)
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

    suspend fun createPartialInvoiceReturn(invoiceId: Long, requestedLines: List<InvoiceReturnLineInput>, note: String = "") {
        require(requestedLines.isNotEmpty()) { "حداقل یک ردیف برای برگشت انتخاب کنید" }
        require(requestedLines.all { it.invoiceLineId > 0 && it.quantityKg.isFinite() && it.quantityKg > 0.0 }) {
            "مقدار برگشتی هر ردیف باید مثبت و معتبر باشد"
        }
        require(requestedLines.map { it.invoiceLineId }.distinct().size == requestedLines.size) {
            "هر ردیف فاکتور را فقط یک بار انتخاب کنید"
        }
        db.withTransaction {
            ensureBaseAccounts()
            val invoice = db.invoiceDao().getById(invoiceId) ?: error("فاکتور پیدا نشد")
            require(invoice.status == "POSTED") { "فقط فاکتور ثبت‌شده قابل برگشت است" }
            val sourceLines = db.invoiceReturnDao().returnableLinesForInvoice(invoiceId)
            require(sourceLines.isNotEmpty()) { "ردیف‌های فاکتور پیدا نشد" }
            val selected = requestedLines.map { input ->
                val source = sourceLines.firstOrNull { it.invoiceLineId == input.invoiceLineId }
                    ?: error("ردیف انتخاب‌شده متعلق به این فاکتور نیست")
                val remaining = source.originalQuantityKg - source.returnedQuantityKg
                require(input.quantityKg <= remaining + 0.000001) {
                    "مقدار برگشتی ${source.productName} از مقدار باقی‌مانده بیشتر است"
                }
                source to input.quantityKg
            }
            val grossByLine = selected.map { (line, quantity) ->
                val gross = BigDecimal.valueOf(line.unitPriceRial)
                    .multiply(BigDecimal.valueOf(quantity))
                    .setScale(0, java.math.RoundingMode.HALF_UP).longValueExact()
                require(gross > 0) { "مبلغ ردیف برگشتی معتبر نیست" }
                gross
            }
            val grossReturn = grossByLine.fold(0L) { total, value -> Math.addExact(total, value) }
            val grossReturnedBefore = sourceLines.fold(0L) { total, line ->
                val prior = BigDecimal.valueOf(line.unitPriceRial).multiply(BigDecimal.valueOf(line.returnedQuantityKg))
                    .setScale(0, java.math.RoundingMode.HALF_UP).longValueExact()
                Math.addExact(total, prior)
            }
            val grossReturnedAfter = Math.addExact(grossReturnedBefore, grossReturn)
            val originalNet = Math.subtractExact(invoice.subtotalRial, invoice.discountRial)
            fun proportional(total: Long, part: Long, whole: Long): Long =
                if (total == 0L || part == 0L) 0L else
                    BigDecimal.valueOf(total).multiply(BigDecimal.valueOf(part))
                        .divide(BigDecimal.valueOf(whole), 0, java.math.RoundingMode.HALF_UP)
                        .longValueExact()
            val discountBefore = proportional(invoice.discountRial, grossReturnedBefore, invoice.subtotalRial)
                .coerceAtMost(invoice.discountRial)
            val discountAfter = proportional(invoice.discountRial, grossReturnedAfter, invoice.subtotalRial)
                .coerceAtMost(invoice.discountRial)
            val discountReturn = Math.subtractExact(discountAfter, discountBefore)
            val netReturn = Math.subtractExact(grossReturn, discountReturn)
            val netReturnedBefore = Math.subtractExact(grossReturnedBefore, discountBefore)
            val netReturnedAfter = Math.subtractExact(grossReturnedAfter, discountAfter)
            val taxBefore = proportional(invoice.taxRial, netReturnedBefore, originalNet).coerceAtMost(invoice.taxRial)
            val taxAfter = proportional(invoice.taxRial, netReturnedAfter, originalNet).coerceAtMost(invoice.taxRial)
            val taxReturn = Math.subtractExact(taxAfter, taxBefore)
            val extraCostsBefore = proportional(invoice.extraCostsRial, grossReturnedBefore, invoice.subtotalRial)
                .coerceAtMost(invoice.extraCostsRial)
            val extraCostsAfter = proportional(invoice.extraCostsRial, grossReturnedAfter, invoice.subtotalRial)
                .coerceAtMost(invoice.extraCostsRial)
            val extraCostsReturn = Math.subtractExact(extraCostsAfter, extraCostsBefore)
            val returnAmount = Math.addExact(Math.addExact(netReturn, taxReturn), extraCostsReturn)
            require(returnAmount > 0) { "مبلغ برگشت باید بیشتر از صفر باشد" }
            val alreadyReturned = db.invoiceReturnDao().returnedForInvoice(invoiceId)
            val alreadySettled = db.invoiceDao().settledForInvoice(invoiceId)
            require(Math.addExact(alreadyReturned, Math.addExact(alreadySettled, returnAmount)) <= invoice.totalRial) {
                "مبلغ برگشت به‌علاوه تسویه‌های قبلی از مبلغ فاکتور بیشتر می‌شود"
            }

            var totalInventoryCost = 0L
            val lineReturnCosts = mutableListOf<Long>()
            selected.forEach { (line, quantity) ->
                val stored = db.warehouseStockDao().valuation(invoice.warehouseId, line.productId)
                val current = stored?.let { InventoryValuation(it.quantityKg, it.valueRial) }
                    ?: InventoryValuation(0.0, 0L)
                val returnCost = if (invoice.kind == "SALE") {
                    require(line.inventoryCostRial > 0L) {
                        "بهای تمام‌شده ردیف فروش مشخص نیست؛ برگشت خودکار امن نیست"
                    }
                    val previouslyReturnedCost = db.invoiceReturnDao().returnedCostForInvoiceLine(line.invoiceLineId)
                    val remainingQuantity = line.originalQuantityKg - line.returnedQuantityKg
                    val remainingCost = Math.subtractExact(line.inventoryCostRial, previouslyReturnedCost)
                    if (quantity >= remainingQuantity - 0.000001) remainingCost else
                        BigDecimal.valueOf(line.inventoryCostRial).multiply(BigDecimal.valueOf(quantity))
                            .divide(BigDecimal.valueOf(line.originalQuantityKg), 0, java.math.RoundingMode.HALF_UP)
                            .longValueExact().coerceAtMost(remainingCost)
                } else {
                    require(stored != null && current.quantityKg + 0.000001 >= quantity) {
                        "موجودی کافی برای برگشت خرید وجود ندارد"
                    }
                    InventoryValuationEngine.issue(current, quantity).cogsRial
                }
                require(returnCost >= 0L)
                val next = if (invoice.kind == "SALE") {
                    InventoryValuationEngine.receive(current, quantity, returnCost)
                } else {
                    InventoryValuationEngine.issue(current, quantity).remaining
                }
                db.warehouseStockDao().upsertValuation(WarehouseValuationEntity(invoice.warehouseId, line.productId, next.quantityKg, next.valueRial))
                syncGlobalValuation(line.productId)
                db.stockDao().insert(
                    StockMovementEntity(
                        productId = line.productId,
                        quantityKg = if (invoice.kind == "SALE") quantity else -quantity,
                        kind = "PARTIAL_RETURN",
                        referenceId = invoiceId,
                        note = "برگشت جزئی فاکتور ${invoice.number}"
                    )
                )
                db.warehouseStockDao().insertMovement(
                    WarehouseStockMovementEntity(
                        warehouseId = invoice.warehouseId, productId = line.productId,
                        quantityKg = if (invoice.kind == "SALE") quantity else -quantity,
                        kind = "PARTIAL_RETURN", referenceId = invoiceId, note = "برگشت جزئی فاکتور ${invoice.number}"
                    )
                )
                totalInventoryCost = Math.addExact(totalInventoryCost, returnCost)
                lineReturnCosts += returnCost
            }

            val returnId = db.invoiceReturnDao().insert(
                InvoiceReturnEntity(invoiceId = invoiceId, amountRial = returnAmount, note = note.trim())
            )
            var allocatedRefund = 0L
            var allocatedNetSales = 0L
            val returnRows = selected.mapIndexed { index, (line, quantity) ->
                val refund = if (index == selected.lastIndex) Math.subtractExact(returnAmount, allocatedRefund) else
                    BigDecimal.valueOf(returnAmount).multiply(BigDecimal.valueOf(grossByLine[index]))
                        .divide(BigDecimal.valueOf(grossReturn), 0, java.math.RoundingMode.HALF_UP)
                        .longValueExact().also { allocatedRefund = Math.addExact(allocatedRefund, it) }
                val netSales = if (invoice.kind != "SALE") 0L else if (index == selected.lastIndex)
                    Math.subtractExact(netReturn, allocatedNetSales) else
                    BigDecimal.valueOf(netReturn).multiply(BigDecimal.valueOf(grossByLine[index]))
                        .divide(BigDecimal.valueOf(grossReturn), 0, java.math.RoundingMode.HALF_UP)
                        .longValueExact().also { allocatedNetSales = Math.addExact(allocatedNetSales, it) }
                InvoiceReturnLineEntity(
                    returnId = returnId,
                    invoiceLineId = line.invoiceLineId,
                    quantityKg = quantity,
                    refundAmountRial = refund,
                    inventoryCostRial = lineReturnCosts[index],
                    netSalesRial = netSales
                )
            }
            db.invoiceReturnDao().insertLines(returnRows)

            val drafts = if (invoice.kind == "SALE") {
                buildList {
                    add(VoucherLineDraft("4101", debitRial = netReturn))
                    if (taxReturn > 0) add(VoucherLineDraft("2103", debitRial = taxReturn))
                    add(VoucherLineDraft("1103", creditRial = returnAmount))
                    if (totalInventoryCost > 0) {
                        add(VoucherLineDraft("1301", debitRial = totalInventoryCost))
                        add(VoucherLineDraft("5101", creditRial = totalInventoryCost))
                    }
                }
            } else {
                listOf(VoucherLineDraft("2101", debitRial = returnAmount), VoucherLineDraft("1301", creditRial = returnAmount)) +
                    AccountingEngine.purchaseReversalAdjustment(totalInventoryCost, returnAmount)
            }
            AccountingEngine.requireBalanced(drafts)
            val voucherId = db.voucherDao().insert(
                VoucherEntity(
                    number = "PR-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(8)}",
                    description = "برگشت جزئی فاکتور ${invoice.number}",
                    reference = "INVOICE_RETURN:$returnId"
                )
            )
            db.voucherLineDao().insertAll(drafts.map { draft ->
                val account = db.accountDao().byCode(draft.accountCode)
                    ?: error("حساب ${draft.accountCode} تعریف نشده است")
                VoucherLineEntity(
                    voucherId = voucherId, accountId = account.id,
                    debitRial = draft.debitRial, creditRial = draft.creditRial,
                    description = "برگشت جزئی فاکتور ${invoice.number}"
                )
            })
            db.partyLedgerDao().insert(
                PartyLedgerEntity(
                    partyId = invoice.partyId,
                    debitRial = if (invoice.kind == "PURCHASE") returnAmount else 0L,
                    creditRial = if (invoice.kind == "SALE") returnAmount else 0L,
                    description = "برگشت جزئی فاکتور ${invoice.number}",
                    referenceId = returnId
                )
            )
        }
    }

    suspend fun reverseInvoice(invoiceId: Long) {
        db.withTransaction {
            ensureBaseAccounts()
            val invoice = db.invoiceDao().getById(invoiceId) ?: error("فاکتور پیدا نشد")
            require(invoice.status == "POSTED") { "فقط فاکتور ثبت‌شده قابل برگشت است" }
            require(db.invoiceDao().settledForInvoice(invoiceId) == 0L) {
                "این فاکتور تسویه تخصیص‌یافته دارد؛ ابتدا تخصیص‌های دریافت/پرداخت را لغو کن"
            }
            require(db.invoiceReturnDao().returnedForInvoice(invoiceId) == 0L) { "این فاکتور برگشت جزئی دارد؛ برگشت کامل جداگانه مجاز نیست" }
            val lines = db.invoiceLineDao().byInvoice(invoiceId)
            require(lines.isNotEmpty()) { "ردیف‌های فاکتور برای برگشت پیدا نشد" }
            var purchaseReversalInventoryCost = 0L
            lines.forEach { line ->
                val stored = db.warehouseStockDao().valuation(invoice.warehouseId, line.productId)
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
                db.warehouseStockDao().upsertValuation(WarehouseValuationEntity(invoice.warehouseId, line.productId, next.quantityKg, next.valueRial))
                syncGlobalValuation(line.productId)
                db.stockDao().insert(
                    StockMovementEntity(
                        productId = line.productId,
                        quantityKg = if (invoice.kind == "SALE") line.quantityKg else -line.quantityKg,
                        kind = "REVERSAL",
                        referenceId = invoiceId,
                        note = "برگشت ${invoice.number}"
                    )
                )
                db.warehouseStockDao().insertMovement(WarehouseStockMovementEntity(
                    warehouseId = invoice.warehouseId, productId = line.productId,
                    quantityKg = if (invoice.kind == "SALE") line.quantityKg else -line.quantityKg,
                    kind = "REVERSAL", referenceId = invoiceId, note = "برگشت ${invoice.number}"
                ))
                db.warehouseStockDao().insertMovement(
                    WarehouseStockMovementEntity(
                        warehouseId = invoice.warehouseId, productId = line.productId,
                        quantityKg = if (invoice.kind == "SALE") line.quantityKg else -line.quantityKg,
                        kind = "REVERSAL", referenceId = invoiceId, note = "برگشت ${invoice.number}"
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


    suspend fun allocateTreasuryToInvoice(treasuryEntryId: Long, invoiceId: Long, amountRial: Long) {
        require(amountRial > 0) { "مبلغ تخصیص باید بیشتر از صفر باشد" }
        db.withTransaction {
            val entry = db.treasuryDao().byId(treasuryEntryId) ?: error("رسید دریافت/پرداخت پیدا نشد")
            val invoice = db.invoiceDao().getById(invoiceId) ?: error("فاکتور پیدا نشد")
            require(invoice.status == "POSTED") { "فقط فاکتور ثبت‌شده قابل تسویه است" }
            require(entry.partyId == invoice.partyId) { "طرف حساب فاکتور با رسید انتخاب‌شده یکسان نیست" }
            require((entry.kind == "RECEIPT" && invoice.kind == "SALE") ||
                (entry.kind == "PAYMENT" && invoice.kind == "PURCHASE")) {
                "نوع دریافت/پرداخت با نوع فاکتور سازگار نیست"
            }
            val invoiceRemaining = Math.subtractExact(Math.subtractExact(invoice.totalRial, db.invoiceDao().settledForInvoice(invoiceId)), db.invoiceReturnDao().returnedForInvoice(invoiceId))
            val entryRemaining = Math.subtractExact(entry.amountRial, db.treasuryDao().allocatedAmount(treasuryEntryId))
            require(invoiceRemaining > 0) { "این فاکتور قبلاً کامل تسویه شده است" }
            require(entryRemaining > 0) { "مبلغ این رسید قبلاً کامل تخصیص یافته است" }
            require(amountRial <= invoiceRemaining) { "مبلغ تخصیص از مانده فاکتور بیشتر است" }
            require(amountRial <= entryRemaining) { "مبلغ تخصیص از مانده رسید بیشتر است" }
            db.invoiceSettlementDao().insert(InvoiceSettlementEntity(invoiceId = invoiceId, treasuryEntryId = treasuryEntryId, amountRial = amountRial))
        }
    }

    suspend fun removeInvoiceSettlement(settlementId: Long) {
        db.withTransaction {
            val settlement = db.invoiceSettlementDao().byId(settlementId)
                ?: error("تخصیص تسویه پیدا نشد یا قبلاً لغو شده است")
            db.invoiceDao().getById(settlement.invoiceId) ?: error("فاکتور مرتبط با تخصیص پیدا نشد")
            val entry = db.treasuryDao().byId(settlement.treasuryEntryId)
                ?: error("رسید مرتبط با تخصیص پیدا نشد")
            require(settlement.amountRial > 0L) { "مبلغ تخصیص نامعتبر است" }
            require(entry.amountRial >= db.treasuryDao().allocatedAmount(entry.id)) {
                "جمع تخصیص‌های رسید از مبلغ اصلی آن بیشتر است"
            }
            db.invoiceSettlementDao().deleteById(settlementId)
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

    suspend fun addBankStatementLine(
        bankName: String, transactionDateEpoch: Long, signedAmountRial: Long,
        bankReference: String, description: String
    ) {
        require(bankName.isNotBlank()) { "نام بانک الزامی است" }
        require(transactionDateEpoch > 0L) { "تاریخ گردش بانکی معتبر نیست" }
        require(signedAmountRial != 0L && signedAmountRial != Long.MIN_VALUE) { "مبلغ گردش بانکی معتبر نیست" }
        db.bankStatementDao().insert(BankStatementLineEntity(
            bankName = bankName.trim(), transactionDateEpoch = transactionDateEpoch,
            signedAmountRial = signedAmountRial, bankReference = bankReference.trim(),
            description = description.trim()
        ))
    }

    suspend fun matchBankStatementLine(statementLineId: Long, treasuryEntryId: Long) {
        db.withTransaction {
            val line = db.bankStatementDao().getById(statementLineId) ?: error("ردیف صورت‌حساب بانکی پیدا نشد")
            require(line.matchedTreasuryEntryId == null && line.matchedCheckId == null && line.matchedVoucherId == null) { "این ردیف بانکی قبلاً تطبیق داده شده است" }
            val entry = db.treasuryDao().byId(treasuryEntryId) ?: error("سند دریافت/پرداخت پیدا نشد")
            require(entry.method == "BANK") { "فقط دریافت یا پرداخت بانکی قابل تطبیق است" }
            require(db.bankStatementDao().countMatches(treasuryEntryId) == 0) { "این سند قبلاً با گردش بانکی دیگری تطبیق داده شده است" }
            val expected = if (entry.kind == "RECEIPT") entry.amountRial else Math.negateExact(entry.amountRial)
            require(line.signedAmountRial == expected) { "مبلغ یا جهت گردش بانکی با سند انتخاب‌شده یکسان نیست" }
            db.bankStatementDao().update(line.copy(matchedTreasuryEntryId = treasuryEntryId))
        }
    }

    suspend fun unmatchBankStatementLine(statementLineId: Long) {
        db.withTransaction {
            val line = db.bankStatementDao().getById(statementLineId) ?: error("ردیف صورت‌حساب بانکی پیدا نشد")
            require(line.matchedTreasuryEntryId != null) { "این ردیف هنوز تطبیق داده نشده است" }
            db.bankStatementDao().update(line.copy(matchedTreasuryEntryId = null))
        }
    }

    suspend fun matchBankStatementLineToCheck(statementLineId: Long, checkId: Long) {
        db.withTransaction {
            val line = db.bankStatementDao().getById(statementLineId) ?: error("ردیف صورت‌حساب بانکی پیدا نشد")
            require(line.matchedTreasuryEntryId == null && line.matchedCheckId == null && line.matchedVoucherId == null) {
                "این گردش قبلاً تطبیق داده شده است"
            }
            val check = db.checkDao().getById(checkId) ?: error("چک پیدا نشد")
            require(check.status == "CLEARED") { "فقط چک‌های تسویه‌شده قابل تطبیق هستند" }
            require(db.bankStatementDao().countCheckMatches(checkId) == 0) { "این چک قبلاً با گردش دیگری تطبیق داده شده است" }
            val expected = if (check.kind == "RECEIVED") check.amountRial else Math.negateExact(check.amountRial)
            require(line.signedAmountRial == expected) { "مبلغ یا جهت گردش بانکی با چک انتخاب‌شده یکسان نیست" }
            db.bankStatementDao().update(line.copy(matchedCheckId = checkId))
        }
    }

    suspend fun importBankStatementCsv(bankName: String, rows: List<BankStatementCsvRow>): Pair<Int, Int> {
        require(bankName.isNotBlank()) { "نام بانک الزامی است" }
        require(rows.isNotEmpty()) { "فایلی برای ورود وجود ندارد" }
        val normalizedBank = bankName.trim()
        return db.withTransaction {
            var inserted = 0
            var skipped = 0
            rows.forEach { row ->
                val duplicate = db.bankStatementDao().countDuplicate(
                    normalizedBank, row.transactionDateEpoch, row.signedAmountRial, row.bankReference.trim()
                ) > 0
                if (duplicate) {
                    skipped++
                } else {
                    db.bankStatementDao().insert(
                        BankStatementLineEntity(
                            bankName = normalizedBank,
                            transactionDateEpoch = row.transactionDateEpoch,
                            signedAmountRial = row.signedAmountRial,
                            bankReference = row.bankReference.trim(),
                            description = row.description.trim()
                        )
                    )
                    inserted++
                }
            }
            inserted to skipped
        }
    }

    suspend fun addBankStatementPeriod(
        bankName: String, startDateEpoch: Long, endDateEpoch: Long,
        openingBalanceRial: Long, closingBalanceRial: Long
    ) {
        require(bankName.isNotBlank()) { "نام بانک الزامی است" }
        require(startDateEpoch > 0L && endDateEpoch >= startDateEpoch) { "بازه زمانی صورت‌حساب معتبر نیست" }
        db.withTransaction {
            val normalized = bankName.trim()
            require(db.bankStatementPeriodDao().find(normalized, startDateEpoch, endDateEpoch) == null) {
                "برای این بانک و بازه زمانی قبلاً صورت‌حساب ثبت شده است"
            }
            db.bankStatementPeriodDao().insert(BankStatementPeriodEntity(
                bankName = normalized, startDateEpoch = startDateEpoch, endDateEpoch = endDateEpoch,
                openingBalanceRial = openingBalanceRial, closingBalanceRial = closingBalanceRial
            ))
        }
    }

    suspend fun addBankFee(
        bankName: String, transactionDateEpoch: Long, amountRial: Long,
        bankReference: String, description: String
    ) {
        require(bankName.isNotBlank()) { "نام بانک الزامی است" }
        require(transactionDateEpoch > 0L) { "تاریخ کارمزد معتبر نیست" }
        require(amountRial > 0L && amountRial != Long.MIN_VALUE) { "مبلغ کارمزد باید مثبت باشد" }
        db.withTransaction {
            ensureBaseAccounts()
            val bank = db.accountDao().byCode("1102") ?: error("حساب بانک تعریف نشده است")
            val fee = db.accountDao().byCode("5203") ?: error("حساب کارمزد بانکی تعریف نشده است")
            val ref = "BANK_FEE:" + UUID.randomUUID().toString()
            val voucherId = db.voucherDao().insert(VoucherEntity(
                number = "BF-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().take(6),
                dateEpoch = transactionDateEpoch,
                description = if (description.isBlank()) "کارمزد بانکی - $bankName" else description.trim(),
                reference = ref
            ))
            db.voucherLineDao().insertAll(listOf(
                VoucherLineEntity(voucherId = voucherId, accountId = fee.id, debitRial = amountRial, creditRial = 0L, description = "هزینه کارمزد بانکی"),
                VoucherLineEntity(voucherId = voucherId, accountId = bank.id, debitRial = 0L, creditRial = amountRial, description = "کسر از حساب بانکی")
            ))
            db.bankStatementDao().insert(BankStatementLineEntity(
                bankName = bankName.trim(), transactionDateEpoch = transactionDateEpoch,
                signedAmountRial = Math.negateExact(amountRial), bankReference = bankReference.trim(),
                description = if (description.isBlank()) "کارمزد بانکی" else description.trim(),
                matchedVoucherId = voucherId
            ))
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
                val oldValuation = db.warehouseStockDao().valuation(1L, line.productId)
                if (oldValuation == null && db.warehouseStockDao().stockForProduct(1L, line.productId) > 0.000001) {
                    error("ابتدا بهای افتتاحیه کالای موجود در انبار اصلی را ثبت کنید")
                }
                val currentValuation = oldValuation?.let { InventoryValuation(it.quantityKg, it.valueRial) } ?: InventoryValuation(0.0, 0L)
                val nextValuation = InventoryValuationEngine.receive(currentValuation, line.quantityKg, line.allocatedCostRial)
                db.warehouseStockDao().upsertValuation(WarehouseValuationEntity(1L, line.productId, nextValuation.quantityKg, nextValuation.valueRial))
                syncGlobalValuation(line.productId)
                db.stockDao().insert(StockMovementEntity(
                    productId = line.productId, quantityKg = line.quantityKg,
                    kind = "IMPORT_RECEIPT", referenceId = receiptId,
                    note = "رسید محموله " + order.containerCode
                ))
                db.warehouseStockDao().insertMovement(WarehouseStockMovementEntity(
                    warehouseId = 1L, productId = line.productId, quantityKg = line.quantityKg,
                    kind = "IMPORT_RECEIPT", referenceId = receiptId, note = "رسید محموله " + order.containerCode
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
            AccountEntity(code = "5202", title = "اختلاف بهای برگشت خرید", type = "EXPENSE"),
            AccountEntity(code = "5203", title = "کارمزد خدمات بانکی", type = "EXPENSE")
        )
        accounts.forEach { db.accountDao().insertIgnore(it) }
    }
}
