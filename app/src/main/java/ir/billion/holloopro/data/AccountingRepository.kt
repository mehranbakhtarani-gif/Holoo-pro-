package ir.billion.holloopro.data

import androidx.room.withTransaction
import ir.billion.holloopro.accounting.AccountingEngine
import ir.billion.holloopro.accounting.LandedCostCalculator
import ir.billion.holloopro.accounting.VoucherLineDraft
import java.util.Locale

class AccountingRepository(private val db: AppDatabase) {
    val products = db.productDao().observeWithStock()
    val parties = db.partyDao().observeAll()
    val suppliers = db.partyDao().observeSuppliers()
    val invoices = db.invoiceDao().observeAll()
    val imports = db.importOrderDao().observeAll()
    val productCount = db.productDao().observeCount()
    val partyCount = db.partyDao().observeCount()
    val invoiceCount = db.invoiceDao().observeCount()
    val voucherCount = db.voucherDao().observeCount()
    val importCount = db.importOrderDao().observeCount()

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

    suspend fun deleteProduct(id: Long) {
        val stock = db.stockDao().stockForProduct(id)
        require(kotlin.math.abs(stock) < 0.000001) { "کالای دارای موجودی را نمی‌توان حذف کرد" }
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

    suspend fun createAndPostInvoice(
        kind: String, partyId: Long, productId: Long, quantityKg: Double,
        unitPriceRial: Long, discountRial: Long, taxRial: Long
    ) {
        require(kind == "SALE" || kind == "PURCHASE")
        require(quantityKg > 0 && quantityKg.isFinite()) { "مقدار باید بیشتر از صفر باشد" }
        require(unitPriceRial > 0 && discountRial >= 0 && taxRial >= 0)
        val subtotal = (quantityKg * unitPriceRial).toLong()
        require(discountRial <= subtotal) { "تخفیف از مبلغ کالا بیشتر است" }
        val total = Math.addExact(subtotal - discountRial, taxRial)
        require(total > 0) { "مبلغ فاکتور باید بیشتر از صفر باشد" }

        db.withTransaction {
            val product = db.productDao().getById(productId) ?: error("کالا پیدا نشد")
            val party = db.partyDao().getById(partyId) ?: error("طرف حساب پیدا نشد")
            if (kind == "SALE") {
                require(party.kind != "SUPPLIER") { "برای فروش، مشتری انتخاب کنید" }
                val available = db.stockDao().stockForProduct(productId)
                require(available + 0.000001 >= quantityKg) { "موجودی کافی نیست؛ موجودی: $available کیلوگرم" }
            } else {
                require(party.kind != "CUSTOMER") { "برای خرید، تأمین‌کننده انتخاب کنید" }
            }

            val number = "HP-${System.currentTimeMillis()}"
            val invoiceId = db.invoiceDao().insert(
                InvoiceEntity(
                    number = number,
                    kind = kind,
                    partyId = partyId,
                    subtotalRial = subtotal,
                    discountRial = discountRial,
                    taxRial = taxRial,
                    totalRial = total,
                    status = "POSTED"
                )
            )
            db.invoiceLineDao().insertAll(
                listOf(
                    InvoiceLineEntity(
                        invoiceId = invoiceId,
                        productId = productId,
                        quantityKg = quantityKg,
                        unitPriceRial = unitPriceRial,
                        lineTotalRial = subtotal
                    )
                )
            )
            db.stockDao().insert(
                StockMovementEntity(
                    productId = productId,
                    quantityKg = if (kind == "SALE") -quantityKg else quantityKg,
                    kind = if (kind == "SALE") "SALE" else "PURCHASE",
                    referenceId = invoiceId,
                    note = number
                )
            )

            ensureBaseAccounts()
            val debitCode = if (kind == "SALE") "1103" else "1301"
            val creditCode = if (kind == "SALE") "4101" else "2101"
            val drafts = listOf(
                VoucherLineDraft(debitCode, debitRial = total),
                VoucherLineDraft(creditCode, creditRial = total)
            )
            AccountingEngine.requireBalanced(drafts)
            val debitAccount = db.accountDao().byCode(debitCode) ?: error("حساب بدهکار تعریف نشده")
            val creditAccount = db.accountDao().byCode(creditCode) ?: error("حساب بستانکار تعریف نشده")
            val voucherId = db.voucherDao().insert(
                VoucherEntity(
                    number = "S-${System.currentTimeMillis()}",
                    description = if (kind == "SALE") "ثبت فروش ${product.name}" else "ثبت خرید ${product.name}",
                    reference = "INVOICE:$invoiceId"
                )
            )
            db.voucherLineDao().insertAll(
                listOf(
                    VoucherLineEntity(voucherId = voucherId, accountId = debitAccount.id, debitRial = total, creditRial = 0),
                    VoucherLineEntity(voucherId = voucherId, accountId = creditAccount.id, debitRial = 0, creditRial = total)
                )
            )
            db.partyLedgerDao().insert(
                PartyLedgerEntity(
                    partyId = partyId,
                    debitRial = if (kind == "SALE") total else 0,
                    creditRial = if (kind == "PURCHASE") total else 0,
                    description = if (kind == "SALE") "فاکتور فروش $number" else "فاکتور خرید $number",
                    referenceId = invoiceId
                )
            )
        }
    }

    suspend fun reverseInvoice(invoiceId: Long) {
        db.withTransaction {
            val invoice = db.invoiceDao().getById(invoiceId) ?: error("فاکتور پیدا نشد")
            require(invoice.status == "POSTED") { "فقط فاکتور ثبت‌شده قابل برگشت است" }
            val lines = db.invoiceLineDao().byInvoice(invoiceId)
            lines.forEach { line ->
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
                        number = "R-${System.currentTimeMillis()}",
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

    suspend fun addImportOrder(
        supplierId: Long, currency: String, fxRateToRial: Long, containerCode: String,
        grossWeightKg: Double, goodsAmountMinor: Long, freightRial: Long,
        customsRial: Long, otherCostsRial: Long, creditDays: Int
    ) {
        require(currency in setOf("USD", "CNY", "IRR"))
        require(fxRateToRial > 0 && grossWeightKg > 0 && grossWeightKg.isFinite())
        require(goodsAmountMinor >= 0 && creditDays >= 0)
        require(containerCode.isNotBlank()) { "شماره کانتینر الزامی است" }
        val supplier = db.partyDao().getById(supplierId) ?: error("تأمین‌کننده پیدا نشد")
        require(supplier.kind != "CUSTOMER") { "طرف حساب انتخاب‌شده تأمین‌کننده نیست" }
        val total = LandedCostCalculator.totalCostRial(
            goodsAmountMinor, if (currency == "IRR") 1 else fxRateToRial,
            freightRial, customsRial, otherCostsRial
        )
        require(total >= 0)
        val now = System.currentTimeMillis()
        db.importOrderDao().insert(
            ImportOrderEntity(
                supplierId = supplierId,
                currency = currency,
                fxRateToRial = if (currency == "IRR") 1 else fxRateToRial,
                containerCode = containerCode.trim(),
                orderedAt = now,
                grossWeightKg = grossWeightKg,
                goodsAmountMinor = goodsAmountMinor,
                freightRial = freightRial,
                customsRial = customsRial,
                otherCostsRial = otherCostsRial,
                supplierDueAt = now + creditDays.toLong() * 86_400_000L
            )
        )
    }

    private suspend fun ensureBaseAccounts() {
        val accounts = listOf(
            AccountEntity(code = "1101", title = "صندوق", type = "ASSET"),
            AccountEntity(code = "1102", title = "بانک", type = "ASSET"),
            AccountEntity(code = "1103", title = "حساب‌های دریافتنی", type = "ASSET"),
            AccountEntity(code = "1301", title = "موجودی کالا", type = "ASSET"),
            AccountEntity(code = "2101", title = "حساب‌های پرداختنی", type = "LIABILITY"),
            AccountEntity(code = "4101", title = "فروش کالا", type = "REVENUE")
        )
        accounts.forEach { db.accountDao().insertIgnore(it) }
    }
}
