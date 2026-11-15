package ir.billion.holloopro.data

import android.content.Context
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import androidx.core.content.FileProvider
import java.io.File
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object InvoicePdf {
    fun create(
        context: Context,
        invoice: InvoiceEntity,
        party: PartyEntity?,
        lines: List<ReturnableInvoiceLineRow>,
        warehouseName: String
    ): File {
        require(lines.isNotEmpty()) { "ردیف‌های فاکتور برای ساخت PDF پیدا نشد" }
        val document = PdfDocument()
        val width = 595
        val height = 842
        val margin = 34
        val body = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.BLACK; textSize = 10f }
        val muted = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.DKGRAY; textSize = 9f }
        val heading = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(15, 55, 75)
            textSize = 17f
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
        }
        val title = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.BLACK
            textSize = 23f
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
        }
        var pageNumber = 1
        var page = document.startPage(PdfDocument.PageInfo.Builder(width, height, pageNumber).create())
        var y = margin
        fun nextPage() {
            document.finishPage(page)
            pageNumber++
            page = document.startPage(PdfDocument.PageInfo.Builder(width, height, pageNumber).create())
            y = margin
        }
        fun line(value: String, paint: TextPaint = body, gap: Int = 6) {
            val layout = StaticLayout.Builder.obtain(value, 0, value.length, paint, width - margin * 2)
                .setAlignment(Layout.Alignment.ALIGN_OPPOSITE)
                .setTextDirection(TextDirectionHeuristics.RTL)
                .setLineSpacing(2f, 1f)
                .build()
            if (y + layout.height > height - margin) nextPage()
            page.canvas.save()
            page.canvas.translate(margin.toFloat(), y.toFloat())
            layout.draw(page.canvas)
            page.canvas.restore()
            y += layout.height + gap
        }
        fun money(value: Long) = NumberFormat.getNumberInstance(Locale("fa", "IR")).format(value) + " ریال"
        val date = SimpleDateFormat("yyyy/MM/dd HH:mm", Locale("fa", "IR")).format(Date(invoice.dateEpoch))
        line("هلو پرو پلاس", title, 3)
        line(if (invoice.kind == "SALE") "فاکتور فروش" else "فاکتور خرید", heading, 3)
        line("شماره: ${invoice.number}     تاریخ: $date")
        line("طرف حساب: ${party?.name ?: "—"}")
        if (!party?.phone.isNullOrBlank()) line("تلفن: ${party?.phone}")
        if (!party?.address.isNullOrBlank()) line("نشانی: ${party?.address}")
        line("انبار: $warehouseName")
        line("────────────────────────────────────────────────────────", muted, 8)
        line("ردیف | شرح کالا | مقدار (کیلو) | قیمت واحد (ریال) | مبلغ (ریال)", heading, 8)
        lines.forEachIndexed { index, item ->
            line("${index + 1} | ${item.productName} | ${NumberFormat.getNumberInstance(Locale("fa", "IR")).format(item.originalQuantityKg)} | ${money(item.unitPriceRial)} | ${money(item.lineTotalRial)}")
        }
        line("────────────────────────────────────────────────────────", muted, 8)
        line("جمع کالاها: ${money(invoice.subtotalRial)}")
        line("تخفیف: ${money(invoice.discountRial)}")
        line("مالیات: ${money(invoice.taxRial)}")
        if (invoice.extraCostsRial > 0) line("هزینه‌های جانبی: ${money(invoice.extraCostsRial)}")
        line("مبلغ نهایی: ${money(invoice.totalRial)}", heading, 16)
        if (invoice.note.isNotBlank()) line("توضیحات: ${invoice.note}")
        line("امضای فروشنده: ........................................")
        line("امضای خریدار: ..........................................")
        line("این سند توسط هلو پرو پلاس تهیه شده است.", muted, 2)
        document.finishPage(page)
        val directory = File(context.cacheDir, "invoices").apply { mkdirs() }
        val output = File(directory, "invoice-${invoice.number}.pdf")
        output.outputStream().use { document.writeTo(it) }
        document.close()
        return output
    }

    fun contentUri(context: Context, file: File) =
        FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}
