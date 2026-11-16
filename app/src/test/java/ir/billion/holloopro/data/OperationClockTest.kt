package ir.billion.holloopro.data

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OperationClockTest {
    @After fun resetClock() { OperationClock.setManualDate(null) }

    @Test fun automaticModeUsesSystemClock() {
        OperationClock.setManualDate(null)
        val before = System.currentTimeMillis()
        val actual = OperationClock.now()
        val after = System.currentTimeMillis()
        assertTrue(actual in before..after)
        assertFalse(OperationClock.isManual())
    }

    @Test fun manualModeReturnsSelectedEpochForAllEntityDefaults() {
        val selected = 1_798_421_400_000L
        OperationClock.setManualDate(selected)
        assertEquals(selected, OperationClock.now())
        assertTrue(OperationClock.isManual())
    }

    @Test fun returningToAutomaticClearsManualOverride() {
        OperationClock.setManualDate(1_798_421_400_000L)
        OperationClock.setManualDate(null)
        assertFalse(OperationClock.isManual())
        val before = System.currentTimeMillis()
        val actual = OperationClock.now()
        val after = System.currentTimeMillis()
        assertTrue(actual in before..after)
    }

    @Test fun manualDateFlowsIntoEveryEntityOperationTimestampDefault() {
        val selected = 1_798_421_400_000L
        OperationClock.setManualDate(selected)

        val product = ProductEntity(sku = "T-1", name = "Test", groupName = "Yarn", yarnType = "FDY", color = "White", denier = 75, twisted = false)
        val party = PartyEntity(name = "Test party", kind = "CUSTOMER")
        val invoice = InvoiceEntity(number = "I-1", kind = "SALE", partyId = 1, subtotalRial = 100, discountRial = 0, taxRial = 0, totalRial = 100)
        val stockMovement = StockMovementEntity(productId = 1, quantityKg = 1.0, kind = "SALE")
        val partyLedger = PartyLedgerEntity(partyId = 1, debitRial = 100, creditRial = 0, description = "Sale")
        val voucher = VoucherEntity(number = "V-1", description = "Sale")
        val receipt = ImportReceiptEntity(importOrderId = 1, goodsCostRial = 100, totalCostRial = 120)
        val valuation = ProductValuationEntity(productId = 1, quantityKg = 1.0, valueRial = 100)
        val treasury = TreasuryEntryEntity(kind = "RECEIPT", method = "CASH", partyId = 1, amountRial = 100)
        val check = CheckEntity(checkNumber = "C-1", kind = "RECEIVED", partyId = 1, amountRial = 100, issueDateEpoch = 10, dueDateEpoch = 20)
        val settlement = InvoiceSettlementEntity(invoiceId = 1, treasuryEntryId = 1, amountRial = 100)
        val invoiceReturn = InvoiceReturnEntity(invoiceId = 1, amountRial = 10)
        val warehouse = WarehouseEntity(name = "Main")
        val warehouseMovement = WarehouseStockMovementEntity(warehouseId = 1, productId = 1, quantityKg = 1.0, kind = "PURCHASE")
        val warehouseValuation = WarehouseValuationEntity(warehouseId = 1, productId = 1, quantityKg = 1.0, valueRial = 100)
        val bankLine = BankStatementLineEntity(bankName = "Test Bank", transactionDateEpoch = 30, signedAmountRial = 100)
        val bankPeriod = BankStatementPeriodEntity(bankName = "Test Bank", startDateEpoch = 10, endDateEpoch = 20, openingBalanceRial = 0, closingBalanceRial = 100)

        listOf(
            product.createdAt, party.createdAt, invoice.dateEpoch, stockMovement.createdAt,
            partyLedger.createdAt, voucher.dateEpoch, receipt.receivedAt, valuation.updatedAt,
            treasury.createdAt, check.createdAt, settlement.createdAt, invoiceReturn.createdAt,
            warehouse.createdAt, warehouseMovement.createdAt, warehouseValuation.updatedAt,
            bankLine.createdAt, bankPeriod.createdAt
        ).forEach { assertEquals(selected, it) }
    }

    @Test fun manuallySelectedOperationDateDoesNotReplaceContractualOrBankTransactionDates() {
        val selected = 1_798_421_400_000L
        OperationClock.setManualDate(selected)

        val issueDate = 10L
        val dueDate = 20L
        val transactionDate = 30L
        val invoice = InvoiceEntity(number = "I-2", kind = "SALE", partyId = 1, dateEpoch = transactionDate, subtotalRial = 100, discountRial = 0, taxRial = 0, totalRial = 100)
        val check = CheckEntity(checkNumber = "C-2", kind = "RECEIVED", partyId = 1, amountRial = 100, issueDateEpoch = issueDate, dueDateEpoch = dueDate)
        val bankLine = BankStatementLineEntity(bankName = "Test Bank", transactionDateEpoch = transactionDate, signedAmountRial = 100)
        val bankPeriod = BankStatementPeriodEntity(bankName = "Test Bank", startDateEpoch = issueDate, endDateEpoch = dueDate, openingBalanceRial = 0, closingBalanceRial = 100)

        assertEquals(transactionDate, invoice.dateEpoch)
        assertEquals(issueDate, check.issueDateEpoch)
        assertEquals(dueDate, check.dueDateEpoch)
        assertEquals(transactionDate, bankLine.transactionDateEpoch)
        assertEquals(issueDate, bankPeriod.startDateEpoch)
        assertEquals(dueDate, bankPeriod.endDateEpoch)
    }


    @Test fun rejectsInvalidManualDates() {
        try {
            OperationClock.setManualDate(0L)
            throw AssertionError("Expected invalid date to be rejected")
        } catch (_: IllegalArgumentException) {
            assertFalse(OperationClock.isManual())
        }
    }
}
