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
        val total = Math.addExact(subtotal - discountRial, taxRial)
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
            val debitCode = if (kind == "SALE") "1103" else "1301"
            val creditCode = if (kind == "SALE") "4101" else "2101"
            val drafts = listOf(VoucherLineDraft(debitCode, debitRial = total), VoucherLineDraft(creditCode, creditRial = total))
            AccountingEngine.requireBalanced(drafts)
            val debitAccount = db.accountDao().byCode(debitCode) ?: error("حساب بدهکار تعریف نشده")
            val creditAccount = db.accountDao().byCode(creditCode) ?: error("حساب بستانکار تعریف نشده")
            val voucherId = db.voucherDao().insert(VoucherEntity(number = "S-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().take(8), description = if (kind == "SALE") "ثبت فروش چندردیفی " + number else "ثبت خرید چندردیفی " + number, reference = "INVOICE:" + invoiceId))
            val voucherLines = mutableListOf(
                VoucherLineEntity(voucherId = voucherId, accountId = debitAccount.id, debitRial = total, creditRial = 0),
                VoucherLineEntity(voucherId = voucherId, accountId = creditAccount.id, debitRial = 0, creditRial = total)
            )
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
            val invoice = db.invoiceDao().getById(invoiceId) ?: error("فاکتور پیدا نشد")
            require(invoice.status == "POSTED") { "فقط فاکتور ثبت‌شده قابل برگشت است" }
            val lines = db.invoiceLineDao().byInvoice(invoiceId)
            require(lines.isNotEmpty()) { "ردیف‌های فاکتور برای برگشت پیدا نشد" }
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
                    InventoryValuationEngine.issue(current, line.quantityKg).remaining
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
            val originalVoucher = db.voucherDao().byReference("INVOICE:$invoiceId")
            if (originalVoucher != null) {
                val oldLines = db.voucherLineDao().byVoucher(originalVoucher.id)
                val reverseId = db.voucherDao().insert(
                    VoucherEntity(
                        number = "R-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(8)}",
                        description = "سند برگشت ${invoice.number}",
                        reference = "REVERSAL:$invoiceId"
                    )
                )
                db.voucherLineDao().insertAll(
                    oldLines.map {
                        VoucherLineEntity(
                            voucherId = reverseId,
                            accountId = it.accountId,
                            debitRial = it.creditRial,
                            creditRial = it.debitRial,
                            description = "برگشت سند"
                        )
                    }
                )
            }
            db.invoiceDao().update(invoice.copy(status = "REVERSED"))
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

    private suspend fun ensureBaseAccounts() {
        val accounts = listOf(
            AccountEntity(code = "1101", title = "صندوق", type = "ASSET"),
            AccountEntity(code = "1102", title = "بانک", type = "ASSET"),
            AccountEntity(code = "1103", title = "حساب‌های دریافتنی", type = "ASSET"),
            AccountEntity(code = "1301", title = "موجودی کالا", type = "ASSET"),
            AccountEntity(code = "2101", title = "حساب‌های پرداختنی تأمین‌کنندگان", type = "LIABILITY"),
            AccountEntity(code = "2102", title = "هزینه‌های حمل و گمرک پرداختنی", type = "LIABILITY"),
            AccountEntity(code = "4101", title = "فروش کالا", type = "REVENUE"),
            AccountEntity(code = "5101", title = "بهای تمام‌شده کالای فروش‌رفته", type = "EXPENSE")
        )
        accounts.forEach { db.accountDao().insertIgnore(it) }
    }
}
