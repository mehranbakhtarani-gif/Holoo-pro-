package ir.billion.holloopro.accounting

import ir.billion.holloopro.data.BankStatementCsv
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BankStatementCsvTest {
    @Test fun parsesPersianHeadersDigitsAndJalaliDates() {
        val csv = """
            تاریخ;واریز;برداشت;شماره پیگیری;شرح
            ۱۴۰۴/۰۱/۰۱;۱٬۲۵۰٬۰۰۰;;۱۲۳۴۵;واریز مشتری
            ۱۴۰۴/۰۱/۰۲;;۲۵۰٬۰۰۰;۱۲۳۴۶;پرداخت
        """.trimIndent()

        val rows = BankStatementCsv.parse(csv)

        assertEquals(2, rows.size)
        assertEquals(1_250_000L, rows[0].signedAmountRial)
        assertEquals(-250_000L, rows[1].signedAmountRial)
        assertEquals("۱۲۳۴۵", rows[0].bankReference)
        assertEquals("واریز مشتری", rows[0].description)
        assertTrue(rows.all { it.transactionDateEpoch > 0L })
    }

    @Test fun parsesQuotedCommaAndEscapedQuotes() {
        val csv = "date,amount,reference,description\n2026-01-15,4500,R-1,\"فروش, نخ \"\"طلایی\"\"\""

        val row = BankStatementCsv.parse(csv).single()

        assertEquals(4_500L, row.signedAmountRial)
        assertEquals("R-1", row.bankReference)
        assertEquals("فروش, نخ \"طلایی\"", row.description)
    }

    @Test fun recognizesWithdrawalTypeAndRejectsInvalidDateOrZeroAmount() {
        val withdrawal = BankStatementCsv.parse(
            "date,amount,type\n2026-02-10,900,withdrawal"
        ).single()
        assertEquals(-900L, withdrawal.signedAmountRial)

        val invalidDate = runCatching {
            BankStatementCsv.parse("date,amount\n2026-02-31,900")
        }
        val zeroAmount = runCatching {
            BankStatementCsv.parse("date,amount\n2026-02-10,0")
        }
        assertTrue(invalidDate.isFailure)
        assertTrue(zeroAmount.isFailure)
    }
}
