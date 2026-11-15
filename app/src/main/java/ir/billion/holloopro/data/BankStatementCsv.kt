package ir.billion.holloopro.data

import java.text.SimpleDateFormat
import java.util.Locale

data class BankStatementCsvRow(
    val transactionDateEpoch: Long,
    val signedAmountRial: Long,
    val bankReference: String = "",
    val description: String = ""
)

object BankStatementCsv {
    fun parse(csv: String): List<BankStatementCsvRow> {
        val text = csv.removePrefix("\uFEFF").trim()
        require(text.isNotBlank()) { "فایل CSV خالی است" }
        val firstLine = text.lineSequence().firstOrNull().orEmpty()
        val delimiter = listOf(',', ';', '\t').maxByOrNull { firstLine.count { ch -> ch == it } } ?: ','
        val records = parseRecords(text, delimiter)
        require(records.size >= 2) { "فایل باید شامل سرستون و حداقل یک ردیف گردش باشد" }
        val headers = records.first().map { normalize(it) }
        fun column(vararg aliases: String): Int = headers.indexOfFirst { h -> aliases.any { h == normalize(it) } }
        val dateCol = column("date", "transaction date", "تاریخ", "تاریخ تراکنش", "تاریخ عملیات")
        val amountCol = column("amount", "مبلغ", "مبلغ تراکنش")
        val depositCol = column("deposit", "credit", "واریز", "بستانکار")
        val withdrawalCol = column("withdrawal", "debit", "برداشت", "بدهکار")
        val typeCol = column("type", "نوع", "نوع تراکنش", "شرح نوع")
        val refCol = column("reference", "ref", "reference number", "شماره پیگیری", "شماره مرجع", "شناسه")
        val descCol = column("description", "شرح", "توضیحات", "بابت")
        require(dateCol >= 0) { "ستون تاریخ شناسایی نشد" }
        require(amountCol >= 0 || depositCol >= 0 || withdrawalCol >= 0) { "ستون مبلغ، واریز یا برداشت شناسایی نشد" }

        return records.drop(1).mapIndexedNotNull { index, row ->
            if (row.all { it.isBlank() }) return@mapIndexedNotNull null
            fun cell(col: Int) = if (col >= 0) row.getOrNull(col).orEmpty().trim() else ""
            val date = parseDate(cell(dateCol))
                ?: error("تاریخ ردیف ${index + 2} معتبر نیست؛ قالب پشتیبانی‌شده YYYY-MM-DD یا YYYY/MM/DD است")
            val deposit = if (depositCol >= 0) parseMoney(cell(depositCol)) else null
            val withdrawal = if (withdrawalCol >= 0) parseMoney(cell(withdrawalCol)) else null
            val signed = when {
                deposit != null && deposit > 0L -> deposit
                withdrawal != null && withdrawal > 0L -> Math.negateExact(withdrawal)
                amountCol >= 0 -> {
                    val amount = parseMoney(cell(amountCol))
                        ?: error("مبلغ ردیف ${index + 2} معتبر نیست")
                    val type = normalize(cell(typeCol))
                    if (amount > 0L && (type.contains("برداشت") || type.contains("debit") || type.contains("withdraw"))) -amount else amount
                }
                else -> error("مبلغ ردیف ${index + 2} خالی یا نامعتبر است")
            }
            require(signed != 0L) { "مبلغ ردیف ${index + 2} نباید صفر باشد" }
            BankStatementCsvRow(date, signed, cell(refCol), cell(descCol))
        }.also { require(it.isNotEmpty()) { "هیچ گردش معتبری در فایل پیدا نشد" } }
    }

    private fun parseRecords(text: String, delimiter: Char): List<List<String>> {
        val rows = mutableListOf<List<String>>()
        var row = mutableListOf<String>()
        val field = StringBuilder()
        var quoted = false
        var i = 0
        while (i < text.length) {
            val ch = text[i]
            when {
                ch == '"' && quoted && i + 1 < text.length && text[i + 1] == '"' -> { field.append('"'); i++ }
                ch == '"' -> quoted = !quoted
                ch == delimiter && !quoted -> { row.add(field.toString()); field.setLength(0) }
                (ch == '\n' || ch == '\r') && !quoted -> {
                    row.add(field.toString()); field.setLength(0)
                    if (row.any { it.isNotBlank() }) rows.add(row)
                    row = mutableListOf()
                    if (ch == '\r' && i + 1 < text.length && text[i + 1] == '\n') i++
                }
                else -> field.append(ch)
            }
            i++
        }
        require(!quoted) { "ساختار نقل‌قول‌ها در فایل CSV ناقص است" }
        row.add(field.toString())
        if (row.any { it.isNotBlank() }) rows.add(row)
        return rows
    }

    private fun normalize(value: String): String = value.trim().lowercase(Locale.ROOT)
        .replace('ي', 'ی').replace('ك', 'ک').replace(" ", "").replace("_", "")

    private fun parseMoney(value: String): Long? {
        val normalized = value.trim().mapIndexed { _, ch ->
            when (ch) {
                in '۰'..'۹' -> ('0'.code + (ch.code - '۰'.code)).toChar()
                in '٠'..'٩' -> ('0'.code + (ch.code - '٠'.code)).toChar()
                else -> ch
            }
        }.joinToString("").replace(",", "").replace("٬", "").replace(" ", "")
            .replace("ریال", "").replace("تومان", "").replace("٫", ".")
        return normalized.toLongOrNull()
    }

    private fun parseDate(value: String): Long? {
        val normalized = value.trim().map { ch ->
            when (ch) {
                in '۰'..'۹' -> ('0'.code + (ch.code - '۰'.code)).toChar()
                in '٠'..'٩' -> ('0'.code + (ch.code - '٠'.code)).toChar()
                else -> ch
            }
        }.joinToString("").replace('/', '-')
        val formats = listOf("yyyy-MM-dd", "yyyy-M-d")
        return formats.firstNotNullOfOrNull { pattern ->
            runCatching {
                SimpleDateFormat(pattern, Locale.US).apply { isLenient = false }.parse(normalized)?.time
            }.getOrNull()
        }
    }
}
