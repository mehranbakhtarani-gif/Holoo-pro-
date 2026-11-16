package ir.billion.holloopro

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.os.Bundle
import android.content.Intent
import android.content.ClipData
import android.os.Process
import android.widget.Toast
import android.net.Uri
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import androidx.activity.ComponentActivity
import androidx.activity.viewModels
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ir.billion.holloopro.accounting.LandedCostCalculator
import ir.billion.holloopro.accounting.Money
import ir.billion.holloopro.accounting.VoucherLineDraft
import java.math.BigInteger
import ir.billion.holloopro.data.CheckEntity
import ir.billion.holloopro.data.BankStatementLineEntity
import ir.billion.holloopro.data.BankStatementPeriodEntity
import ir.billion.holloopro.data.BankStatementCsv
import ir.billion.holloopro.data.BankStatementCsvRow
import ir.billion.holloopro.data.BankMatchCandidate
import ir.billion.holloopro.data.BankReconciliationMatcher
import ir.billion.holloopro.data.DatabaseBackup
import ir.billion.holloopro.data.InvoicePdf
import ir.billion.holloopro.data.ImportOrderEntity
import ir.billion.holloopro.data.ImportReceiptLineInput
import ir.billion.holloopro.data.AccountBalanceRow
import ir.billion.holloopro.data.AccountTrialBalanceRow
import ir.billion.holloopro.data.LedgerRow
import ir.billion.holloopro.data.InvoiceEntity
import ir.billion.holloopro.data.InvoiceLineInput
import ir.billion.holloopro.data.InvoiceReturnLineInput
import ir.billion.holloopro.data.InvoiceReturnSummaryRow
import ir.billion.holloopro.data.ReturnableInvoiceLineRow
import ir.billion.holloopro.data.InvoiceSettlementRow
import ir.billion.holloopro.data.TreasuryEntryEntity
import ir.billion.holloopro.data.TreasuryAllocationRow
import ir.billion.holloopro.data.PartyEntity
import ir.billion.holloopro.data.ProductEntity
import ir.billion.holloopro.data.ProductWithStock
import ir.billion.holloopro.data.WarehouseEntity
import ir.billion.holloopro.data.WarehouseStockRow
import ir.billion.holloopro.data.WarehouseKardexRow
import ir.billion.holloopro.data.ProductProfitRow
import ir.billion.holloopro.data.InvoiceProfitRow
import ir.billion.holloopro.ui.AppViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale
import java.util.Calendar
import java.util.Date
import java.text.SimpleDateFormat

private val Navy = Color(0xFF071629)
private val NavyGlass = Color(0xCC102B46)
private val Turquoise = Color(0xFF36D6C5)
private val Muted = Color(0xFF9FB5C9)
private val CardBorder = Color(0x5536D6C5)

class MainActivity : ComponentActivity() {
    private fun shareInvoicePdf(invoice: InvoiceEntity, party: PartyEntity?, lines: List<ReturnableInvoiceLineRow>, warehouseName: String) {
        runCatching {
            val file = InvoicePdf.create(this, invoice, party, lines, warehouseName)
            val uri = InvoicePdf.contentUri(this, file)
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "فاکتور ${invoice.number}")
                putExtra(Intent.EXTRA_TEXT, "فاکتور ${invoice.number} - هلو پرو پلاس")
                clipData = ClipData.newUri(contentResolver, "فاکتور", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(send, "ارسال فاکتور"))
        }.onFailure { Toast.makeText(this, "ساخت یا ارسال PDF ناموفق بود: ${it.message}", Toast.LENGTH_LONG).show() }
    }

    private lateinit var exportBackupLauncher: androidx.activity.result.ActivityResultLauncher<String>
    private lateinit var importBackupLauncher: androidx.activity.result.ActivityResultLauncher<Array<String>>
    private lateinit var importBankCsvLauncher: androidx.activity.result.ActivityResultLauncher<Array<String>>
    private val pendingBankCsvRows = mutableStateOf<List<BankStatementCsvRow>>(emptyList())
    private val pendingBankCsvName = mutableStateOf("")
    private lateinit var exportReportsLauncher: androidx.activity.result.ActivityResultLauncher<String>
    private lateinit var exportReportsPdfLauncher: androidx.activity.result.ActivityResultLauncher<String>
    private var pendingReportsCsv: String = ""
    private var pendingReportsPdf: ByteArray? = null

    private val vm by viewModels<AppViewModel> {
        AppViewModel.Factory((application as HolooApplication).repository)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        vm.setOperationDate(null)
        exportBackupLauncher = registerForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
            if (uri != null) lifecycleScope.launch {
                runCatching { DatabaseBackup.export(this@MainActivity, (application as HolooApplication).database, uri) }
                    .onSuccess { Toast.makeText(this@MainActivity, "پشتیبان با موفقیت ذخیره شد", Toast.LENGTH_LONG).show() }
                    .onFailure { Toast.makeText(this@MainActivity, "خطا در پشتیبان‌گیری: ${it.message}", Toast.LENGTH_LONG).show() }
            }
        }
        exportReportsLauncher = registerForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
            if (uri != null) lifecycleScope.launch {
                runCatching {
                    val output = contentResolver.openOutputStream(uri) ?: error("امکان ایجاد فایل وجود ندارد")
                    output.bufferedWriter(Charsets.UTF_8).use { it.write(pendingReportsCsv) }
                }.onSuccess { Toast.makeText(this@MainActivity, "گزارش‌ها ذخیره شدند", Toast.LENGTH_LONG).show() }
                    .onFailure { Toast.makeText(this@MainActivity, "خروجی گزارش ناموفق بود: ${it.message}", Toast.LENGTH_LONG).show() }
            }
        }
        exportReportsPdfLauncher = registerForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
            if (uri != null) lifecycleScope.launch {
                runCatching {
                    val bytes = pendingReportsPdf ?: error("گزارشی برای ذخیره آماده نیست")
                    val output = contentResolver.openOutputStream(uri) ?: error("امکان ایجاد فایل PDF وجود ندارد")
                    output.use { it.write(bytes) }
                }.onSuccess { Toast.makeText(this@MainActivity, "گزارش PDF ذخیره شد", Toast.LENGTH_LONG).show() }
                    .onFailure { Toast.makeText(this@MainActivity, "ذخیره PDF ناموفق بود: ${it.message}", Toast.LENGTH_LONG).show() }
            }
        }
        importBankCsvLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null) lifecycleScope.launch {
                runCatching {
                    val csv = contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
                        ?: error("خواندن فایل انتخاب‌شده ممکن نیست")
                    BankStatementCsv.parse(csv)
                }.onSuccess { rows ->
                    pendingBankCsvRows.value = rows
                    pendingBankCsvName.value = ""
                    Toast.makeText(this@MainActivity, "${rows.size} گردش برای پیش‌نمایش آماده شد", Toast.LENGTH_LONG).show()
                }.onFailure {
                    Toast.makeText(this@MainActivity, "خواندن CSV ناموفق بود: ${it.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
        importBackupLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null) lifecycleScope.launch {
                runCatching { DatabaseBackup.restore(this@MainActivity, (application as HolooApplication).database, uri) }
                    .onSuccess {
                        Toast.makeText(this@MainActivity, "بازیابی انجام شد؛ برنامه را دوباره باز کنید", Toast.LENGTH_LONG).show()
                        window.decorView.postDelayed({
                            finishAffinity()
                            Process.killProcess(Process.myPid())
                        }, 1200)
                    }
                    .onFailure { Toast.makeText(this@MainActivity, "بازیابی ناموفق بود: ${it.message}", Toast.LENGTH_LONG).show() }
            }
        }
        setContent {
            HolooTheme {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    val products by vm.products.collectAsState()
                    val warehouses by vm.warehouses.collectAsState()
                    val warehouseStocks by vm.warehouseStocks.collectAsState()
                    val warehouseKardex by vm.warehouseKardex.collectAsState()
                    val parties by vm.parties.collectAsState()
                    val partyBalances by vm.partyBalances.collectAsState()
                    val invoices by vm.invoices.collectAsState()
                    val invoiceSettlements by vm.invoiceSettlements.collectAsState()
                    val invoiceAging by vm.invoiceAging.collectAsState()
                    val invoiceReturnTotals by vm.invoiceReturnTotals.collectAsState()
                    val returnableInvoiceLines by vm.returnableInvoiceLines.collectAsState()
                    val treasuryAllocations by vm.treasuryAllocations.collectAsState()
                    val settlementDetails by vm.settlementDetails.collectAsState()
                    val imports by vm.imports.collectAsState()
                    val treasury by vm.treasury.collectAsState()
                    val accountBalances by vm.accountBalances.collectAsState()
                    val trialBalance by vm.trialBalance.collectAsState()
                    val ledger by vm.ledger.collectAsState()
                    val checks by vm.checks.collectAsState()
                    val bankStatements by vm.bankStatements.collectAsState()
                    val bankStatementPeriods by vm.bankStatementPeriods.collectAsState()
                    val profitLoss by vm.profitLoss.collectAsState()
                    val productProfitability by vm.productProfitability.collectAsState()
                    val invoiceProfitability by vm.invoiceProfitability.collectAsState()
                    val productCount by vm.productCount.collectAsState()
                    val partyCount by vm.partyCount.collectAsState()
                    val invoiceCount by vm.invoiceCount.collectAsState()
                    val voucherCount by vm.voucherCount.collectAsState()
                    val importCount by vm.importCount.collectAsState()
                    val message by vm.message.collectAsState()
                    HolooApp(
                        products, warehouses, warehouseStocks, warehouseKardex, parties, partyBalances, invoices, invoiceSettlements, invoiceReturnTotals, returnableInvoiceLines, treasuryAllocations, settlementDetails, imports, treasury, accountBalances, trialBalance, ledger, checks, bankStatements, bankStatementPeriods, profitLoss, productProfitability, invoiceProfitability, invoiceAging,
                        productCount, partyCount, invoiceCount, voucherCount, importCount,
                        message,
                        onSaveProduct = vm::saveProduct,
                        onDeleteProduct = vm::deleteProduct,
                        onSetOpeningValuation = vm::setOpeningInventoryValuation,
                        onAdjustStock = vm::adjustStock,
                        onCreateWarehouse = vm::createWarehouse,
                        onTransferStock = vm::transferStock,
                        onExportReports = {
                            pendingReportsCsv = buildReportsCsv(productProfitability, invoiceProfitability, warehouseKardex)
                            exportReportsLauncher.launch("holoo-reports.csv")
                        },
                        onExportReportsPdf = {
                            pendingReportsPdf = buildReportsPdf(productProfitability, invoiceProfitability, warehouseKardex)
                            exportReportsPdfLauncher.launch("holoo-reports.pdf")
                        },
                        onSaveParty = vm::saveParty,
                        onPartyLedger = vm::partyLedger,
                        onDeleteParty = vm::deleteParty,
                        onCreateInvoice = vm::createMultiLineInvoice,
                        onEditInvoice = vm::editInvoice,
                        onShareInvoice = { invoice, party, lines, warehouseName -> shareInvoicePdf(invoice, party, lines, warehouseName) },
                        onReverseInvoice = vm::reverseInvoice,
                        onPartialInvoiceReturn = vm::createPartialInvoiceReturn,
                        onAllocateTreasury = vm::allocateTreasuryToInvoice,
                        onRemoveInvoiceSettlement = vm::removeInvoiceSettlement,
                        onAddImport = vm::addImport,
                        onEditImport = vm::updateImportOrder,
                        onReceiveImport = vm::receiveImport,
                        onAddTreasury = vm::addTreasury,
                        onEditTreasury = vm::editTreasury,
                        onAddManualVoucher = vm::addManualVoucher,
                        onUpdateOpeningBalances = vm::updateOpeningBalances,
                        onSaveAccount = vm::saveAccount,
                        onReverseManualVoucher = vm::reverseManualVoucher,
                        onLoadDemoData = vm::loadDemoData,
                        onAddCheck = vm::addCheck,
                        onEditCheck = vm::editCheck,
                        onUpdateCheckStatus = vm::updateCheckStatus,
                                                onAddBankStatementLine = vm::addBankStatementLine,
                        onEditBankStatementLine = vm::editBankStatementLine,
                        onMatchBankStatementLine = vm::matchBankStatementLine,
                        onUnmatchBankStatementLine = vm::unmatchBankStatementLine,
                        onMatchBankStatementLineToCheck = vm::matchBankStatementLineToCheck,
                        onAddBankFee = vm::addBankFee,
                        onAddBankStatementPeriod = vm::addBankStatementPeriod,
                        onImportBankCsv = { importBankCsvLauncher.launch(arrayOf("text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "text/plain", "*/*")) },
                        onClearMessage = vm::clearMessage,
                        onExportBackup = { exportBackupLauncher.launch("holloo-backup-${System.currentTimeMillis()}.db") },
                        onImportBackup = { importBackupLauncher.launch(arrayOf("application/octet-stream", "application/x-sqlite3", "*/*")) },
                        onSetOperationDate = vm::setOperationDate
                    )
                    if (pendingBankCsvRows.value.isNotEmpty()) {
                        BankCsvImportPreviewDialog(
                            rows = pendingBankCsvRows.value,
                            bankName = pendingBankCsvName.value,
                            onBankNameChange = { pendingBankCsvName.value = it },
                            onDismiss = { pendingBankCsvRows.value = emptyList() },
                            onConfirm = {
                                vm.importBankStatementCsv(pendingBankCsvName.value, pendingBankCsvRows.value)
                                pendingBankCsvRows.value = emptyList()
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HolooTheme(content: @Composable () -> Unit) {
    val colors = darkColorScheme(
        primary = Turquoise,
        secondary = Color(0xFF70B9E7),
        background = Navy,
        surface = NavyGlass,
        onPrimary = Navy,
        onBackground = Color(0xFFF2F7FC),
        onSurface = Color(0xFFF2F7FC)
    )
    MaterialTheme(colorScheme = colors, content = content)
}

private enum class Screen(val title: String, val symbol: String) {
    HOME("خانه", "⌂"),
    WAREHOUSES("انبارها", "▤"),
    INVENTORY("کالا و انبار", "▦"),
    PARTIES("اشخاص", "♙"),
    INVOICES("فاکتورها", "▤"),
    IMPORTS("واردات نخ", "▣"),
    ACCOUNTING("حسابداری", "≋"),
    CHECKS("چک‌ها", "▣")
}

@Composable
private fun HolooApp(
    products: List<ProductWithStock>,
    warehouses: List<WarehouseEntity>,
    warehouseStocks: List<WarehouseStockRow>,
    warehouseKardex: List<WarehouseKardexRow>,
    parties: List<PartyEntity>,
    partyBalances: List<ir.billion.holloopro.data.PartyBalanceRow>,
    invoices: List<InvoiceEntity>,
    invoiceSettlements: List<InvoiceSettlementRow>,
    invoiceReturnTotals: List<InvoiceReturnSummaryRow>,
    returnableInvoiceLines: List<ReturnableInvoiceLineRow>,
    treasuryAllocations: List<TreasuryAllocationRow>,
    settlementDetails: List<ir.billion.holloopro.data.InvoiceSettlementDetailRow>,
    imports: List<ImportOrderEntity>,
    treasury: List<ir.billion.holloopro.data.TreasuryEntryEntity>,
    accountBalances: List<AccountBalanceRow>,
    trialBalance: List<AccountTrialBalanceRow>,
    ledger: List<LedgerRow>,
    checks: List<CheckEntity>,
    bankStatements: List<BankStatementLineEntity>,
    bankStatementPeriods: List<BankStatementPeriodEntity>,
    profitLoss: ir.billion.holloopro.data.ProfitLossRow,
    productProfitability: List<ProductProfitRow>,
    invoiceProfitability: List<InvoiceProfitRow>,
    invoiceAging: List<ir.billion.holloopro.data.InvoiceAgingRow>,
    productCount: Int,
    partyCount: Int,
    invoiceCount: Int,
    voucherCount: Int,
    importCount: Int,
    message: String?,
    onSaveProduct: (Long?, String, String, String, String, String, Int, Boolean, String) -> Unit,
    onDeleteProduct: (Long) -> Unit,
    onSetOpeningValuation: (Long, Long, Long) -> Unit,
    onAdjustStock: (Long, Double, Long, Long) -> Unit,
    onCreateWarehouse: (String, String, () -> Unit) -> Unit,
    onTransferStock: (Long, Long, Long, Double, () -> Unit) -> Unit,
    onExportReports: () -> Unit,
    onExportReportsPdf: () -> Unit,
    onSaveParty: (Long?, String, String, String, String, Long) -> Unit,
    onPartyLedger: (Long) -> Flow<List<ir.billion.holloopro.data.PartyLedgerRow>>,
    onDeleteParty: (Long) -> Unit,
    onCreateInvoice: (String, Long, List<InvoiceLineInput>, Long, Long, Long, Long, () -> Unit) -> Unit,
    onEditInvoice: (Long, Long, List<InvoiceLineInput>, Long, Long, Long, Long, () -> Unit) -> Unit,
    onShareInvoice: (InvoiceEntity, PartyEntity?, List<ReturnableInvoiceLineRow>, String) -> Unit,
    onReverseInvoice: (Long) -> Unit,
    onPartialInvoiceReturn: (Long, List<InvoiceReturnLineInput>, String, () -> Unit) -> Unit,
    onAllocateTreasury: (Long, Long, Long, () -> Unit) -> Unit,
    onRemoveInvoiceSettlement: (Long, () -> Unit) -> Unit,
    onAddImport: (Long, String, Long, String, Double, Long, Long, Long, Long, Int, () -> Unit) -> Unit,
    onEditImport: (Long, Long, String, Long, String, Double, Long, Long, Long, Long, Int, () -> Unit) -> Unit,
    onReceiveImport: (Long, List<ImportReceiptLineInput>, () -> Unit) -> Unit,
    onAddTreasury: (String, String, Long, Long, String, String, () -> Unit) -> Unit,
    onEditTreasury: (Long, String, String, Long, Long, String, String, () -> Unit) -> Unit,
    onAddManualVoucher: (String, List<VoucherLineDraft>, () -> Unit) -> Unit,
    onUpdateOpeningBalances: (Map<String, Pair<Long, Long>>) -> Unit,
    onSaveAccount: (String, String, String, () -> Unit) -> Unit,
    onReverseManualVoucher: (String) -> Unit,
    onLoadDemoData: () -> Unit,
    onAddCheck: (String, String, Long, Long, Long, Long, String, String, () -> Unit) -> Unit,
    onEditCheck: (Long, String, String, Long, Long, Long, Long, String, String, () -> Unit) -> Unit,
    onUpdateCheckStatus: (Long, String) -> Unit,
    onAddBankStatementLine: (String, Long, Long, String, String, () -> Unit) -> Unit,
    onEditBankStatementLine: (Long, String, Long, Long, String, String, () -> Unit) -> Unit,
    onMatchBankStatementLine: (Long, Long) -> Unit,
    onUnmatchBankStatementLine: (Long) -> Unit,
    onMatchBankStatementLineToCheck: (Long, Long) -> Unit,
    onAddBankFee: (String, Long, Long, String, String, () -> Unit) -> Unit,
    onAddBankStatementPeriod: (String, Long, Long, Long, Long) -> Unit,
    onImportBankCsv: () -> Unit,
    onClearMessage: () -> Unit,
    onExportBackup: () -> Unit,
    onImportBackup: () -> Unit,
    onSetOperationDate: (Long?) -> Unit
) {
    var screen by remember { mutableStateOf(Screen.HOME) }
    var showToman by remember { mutableStateOf(true) }
    var manualOperationDate by remember { mutableStateOf<Long?>(null) }
    val context = LocalContext.current
    val operationDateLabel = manualOperationDate?.let { SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.US).format(Date(it)) } ?: "اتوماتیک"
    Scaffold(
        containerColor = Navy,
        bottomBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        Brush.horizontalGradient(listOf(Color(0xEE102A44), Color(0xEE0B2038)))
                    )
                    .padding(vertical = 7.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Screen.entries.forEach { item ->
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .clickable { screen = item }
                            .background(if (screen == item) Color(0x4436D6C5) else Color.Transparent)
                            .padding(vertical = 7.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(item.symbol, color = if (screen == item) Turquoise else Muted, fontSize = 20.sp)
                        Text(
                            item.title,
                            color = if (screen == item) Turquoise else Muted,
                            fontSize = 9.sp,
                            maxLines = 1
                        )
                    }
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.verticalGradient(listOf(Color(0xFF0C2740), Navy)))
                .padding(padding)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("HOLLOO PRO+", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Text("مدیریت مالی و بازرگانی نخ", fontSize = 11.sp, color = Muted)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = onExportBackup) { Text("پشتیبان", color = Turquoise, fontSize = 10.sp) }
                    TextButton(onClick = onImportBackup) { Text("بازیابی", color = Color(0xFFFFC47A), fontSize = 10.sp) }
                    TextButton(onClick = { showToman = !showToman }) {
                        Text(if (showToman) "تومان" else "ریال", color = Turquoise, fontSize = 10.sp)
                    }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
                    .clip(RoundedCornerShape(14.dp)).background(Color(0xFF173D55)).padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text("تاریخ عملیات", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Text(operationDateLabel, color = if (manualOperationDate == null) Turquoise else Color(0xFFFFC47A), fontSize = 11.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = { manualOperationDate = null; onSetOperationDate(null) }) {
                    Text("اتوماتیک", color = if (manualOperationDate == null) Turquoise else Muted, fontSize = 10.sp)
                }
                TextButton(onClick = {
                    val initial = Calendar.getInstance().apply { timeInMillis = manualOperationDate ?: System.currentTimeMillis() }
                    DatePickerDialog(context, { _, year, month, day ->
                        val selected = Calendar.getInstance().apply {
                            timeInMillis = initial.timeInMillis
                            set(Calendar.YEAR, year); set(Calendar.MONTH, month); set(Calendar.DAY_OF_MONTH, day)
                        }
                        TimePickerDialog(context, { _, hour, minute ->
                            selected.set(Calendar.HOUR_OF_DAY, hour)
                            selected.set(Calendar.MINUTE, minute)
                            selected.set(Calendar.SECOND, 0)
                            selected.set(Calendar.MILLISECOND, 0)
                            val epoch = selected.timeInMillis
                            manualOperationDate = epoch
                            onSetOperationDate(epoch)
                        }, initial.get(Calendar.HOUR_OF_DAY), initial.get(Calendar.MINUTE), true).show()
                    }, initial.get(Calendar.YEAR), initial.get(Calendar.MONTH), initial.get(Calendar.DAY_OF_MONTH)).show()
                }) {
                    Text("انتخاب دستی", color = Color(0xFFFFC47A), fontSize = 10.sp)
                }
            }
            if (message != null) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
                        .clip(RoundedCornerShape(14.dp)).background(Color(0xFF173D55)).clickable { onClearMessage() }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(message, modifier = Modifier.weight(1f), fontSize = 12.sp, color = Color.White)
                    Text("×", color = Turquoise, fontSize = 20.sp)
                }
            }
            when (screen) {
                Screen.HOME -> HomeScreen(productCount, partyCount, invoiceCount, voucherCount, importCount, showToman, products.sumOf { it.inventoryValueRial }, profitLoss, checks.count { it.status == "OPEN" && it.dueDateEpoch < System.currentTimeMillis() }, onLoadDemoData)
                Screen.WAREHOUSES -> WarehouseScreen(warehouses, warehouseStocks, warehouseKardex, products, showToman, onCreateWarehouse, onTransferStock)
                Screen.INVENTORY -> InventoryScreen(warehouses, warehouseStocks, products, showToman, onSaveProduct, onDeleteProduct, onSetOpeningValuation, onAdjustStock)
                Screen.PARTIES -> PartiesScreen(parties, partyBalances, showToman, onSaveParty, onDeleteParty, onPartyLedger)
                Screen.INVOICES -> InvoicesScreen(warehouses, parties, products, invoices, invoiceSettlements, invoiceReturnTotals, returnableInvoiceLines, settlementDetails, treasury, treasuryAllocations, showToman, onCreateInvoice, onEditInvoice, onShareInvoice, onReverseInvoice, onPartialInvoiceReturn, onAllocateTreasury, onRemoveInvoiceSettlement)
                Screen.IMPORTS -> ImportsScreen(products, parties, imports, showToman, onAddImport, onEditImport, onReceiveImport)
                Screen.ACCOUNTING -> AccountingScreen(voucherCount, invoices, treasury, checks, bankStatements, bankStatementPeriods, accountBalances, trialBalance, ledger, profitLoss, productProfitability, invoiceProfitability, invoiceAging, parties, showToman, onExportReports, onExportReportsPdf, onAddTreasury, onEditTreasury, onAddManualVoucher, onUpdateOpeningBalances, onSaveAccount, onReverseManualVoucher, onAddBankStatementLine, onEditBankStatementLine, onMatchBankStatementLine, onUnmatchBankStatementLine, onMatchBankStatementLineToCheck, onAddBankFee, onAddBankStatementPeriod, onImportBankCsv)
                Screen.CHECKS -> ChecksScreen(checks, parties, showToman, onAddCheck, onEditCheck, onUpdateCheckStatus)
            }
        }
    }
}


@Composable
private fun BankReconciliationSection(
    bankStatements: List<BankStatementLineEntity>,
    bankStatementPeriods: List<BankStatementPeriodEntity>,
    treasury: List<TreasuryEntryEntity>,
    checks: List<CheckEntity>,
    showToman: Boolean,
    onAdd: (String, Long, Long, String, String, () -> Unit) -> Unit,
    onEdit: (Long, String, Long, Long, String, String, () -> Unit) -> Unit,
    onMatch: (Long, Long) -> Unit,
    onUnmatch: (Long) -> Unit,
    onMatchCheck: (Long, Long) -> Unit,
    onAddFee: (String, Long, Long, String, String, () -> Unit) -> Unit,
    onAddPeriod: (String, Long, Long, Long, Long) -> Unit,
    onImportCsv: () -> Unit
) {
    var showDialog by remember { mutableStateOf(false) }
    var editingLine by remember { mutableStateOf<BankStatementLineEntity?>(null) }
    var showFeeDialog by remember { mutableStateOf(false) }
    var showPeriodDialog by remember { mutableStateOf(false) }
    val matchedTreasuryIds = bankStatements.mapNotNull { it.matchedTreasuryEntryId }.toSet()
    val matchedCheckIds = bankStatements.mapNotNull { it.matchedCheckId }.toSet()
    val candidates = treasury.filter { it.method == "BANK" && it.id !in matchedTreasuryIds }
    val clearedChecks = checks.filter { it.status == "CLEARED" && it.id !in matchedCheckIds }
    GlassCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("مغایرت‌گیری بانکی", color = Turquoise, fontWeight = FontWeight.Bold)
                Text("تطبیق دریافت، پرداخت، چک‌های تسویه‌شده و کارمزد", color = Muted, fontSize = 10.sp)
            }
            TextButton(onClick = { showDialog = true }) { Text("+ گردش", color = Turquoise) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { showFeeDialog = true }) { Text("ثبت کارمزد بانکی") }
            OutlinedButton(onClick = { showPeriodDialog = true }) { Text("ثبت دوره صورت‌حساب") }
            OutlinedButton(onClick = onImportCsv) { Text("ورود فایل CSV") }
        }
        val matchedCount = bankStatements.count { it.matchedTreasuryEntryId != null || it.matchedCheckId != null || it.matchedVoucherId != null }
        Text("تطبیق‌شده: $matchedCount • تطبیق‌نشده: ${bankStatements.size - matchedCount}", color = Muted, fontSize = 10.sp)
        if (bankStatementPeriods.isNotEmpty()) {
            Text("کنترل مانده پایان دوره", color = Turquoise, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            bankStatementPeriods.take(12).forEach { period ->
                val reconciliation = ir.billion.holloopro.data.BankStatementReconciliation.calculate(
                    period.openingBalanceRial,
                    bankStatements.filter {
                        it.bankName.equals(period.bankName, ignoreCase = true) &&
                            it.transactionDateEpoch >= period.startDateEpoch && it.transactionDateEpoch <= period.endDateEpoch
                    }.map { it.signedAmountRial },
                    period.closingBalanceRial
                )
                val dateFormat = java.text.SimpleDateFormat("yyyy/MM/dd", Locale.getDefault())
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("${period.bankName} • ${dateFormat.format(java.util.Date(period.startDateEpoch))} تا ${dateFormat.format(java.util.Date(period.endDateEpoch))}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    if (reconciliation.overflow) {
                        Text("خطای محاسباتی: ارقام این دوره از محدوده عددی مجاز خارج شده‌اند؛ مغایرت قابل محاسبه نیست.", color = Color(0xFFFF9D9D), fontSize = 10.sp)
                    } else {
                        val movements = reconciliation.netMovementRial!!
                        val calculated = reconciliation.calculatedClosingBalanceRial!!
                        val difference = reconciliation.differenceRial!!
                        Text("افتتاحیه: ${formatMoney(period.openingBalanceRial, showToman)} • گردش خالص: ${formatMoney(movements, showToman)}", color = Muted, fontSize = 10.sp)
                        Text("مانده محاسباتی: ${formatMoney(calculated, showToman)} • مانده بانک: ${formatMoney(period.closingBalanceRial, showToman)}", color = Muted, fontSize = 10.sp)
                        Text(if (difference == 0L) "مانده‌ها برابرند؛ اختلاف صفر است." else "اختلاف مانده: ${formatMoney(difference, showToman)}", color = if (difference == 0L) Turquoise else Color(0xFFFF9D9D), fontSize = 10.sp)
                    }
                }
                Divider(color = CardBorder)
            }
        }
        if (bankStatements.isEmpty()) Text("هنوز گردش بانکی وارد نشده است.", color = Muted, fontSize = 11.sp)
        bankStatements.take(40).forEach { line ->
            var selectedEntryId by remember(line.id) { mutableStateOf<Long?>(null) }
            var selectedCheckId by remember(line.id) { mutableStateOf<Long?>(null) }
            Divider(color = CardBorder)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(line.bankName + " • " + java.text.SimpleDateFormat("yyyy/MM/dd", Locale.getDefault()).format(java.util.Date(line.transactionDateEpoch)), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                Text((if (line.signedAmountRial > 0) "واریز: " else "برداشت: ") + formatMoney(kotlin.math.abs(line.signedAmountRial), showToman) + " " + (if (showToman) "تومان" else "ریال") + " • " + line.bankReference, color = if (line.signedAmountRial > 0) Turquoise else Color(0xFFFFC47A), fontSize = 11.sp)
                if (line.description.isNotBlank()) Text(line.description, color = Muted, fontSize = 10.sp)
                when {
                    line.matchedTreasuryEntryId != null -> {
                        Text("تطبیق با سند دریافت/پرداخت شماره " + line.matchedTreasuryEntryId, color = Turquoise, fontSize = 10.sp)
                        TextButton(onClick = { onUnmatch(line.id) }) { Text("لغو تطبیق", color = Color(0xFFFF9D9D)) }
                    }
                    line.matchedCheckId != null -> {
                        val check = checks.firstOrNull { it.id == line.matchedCheckId }
                        Text("تطبیق با چک تسویه‌شده شماره " + (check?.checkNumber ?: line.matchedCheckId.toString()), color = Turquoise, fontSize = 10.sp)
                        Text("برای حفظ سابقه حسابداری، تطبیق چک پس از ثبت قابل لغو نیست.", color = Muted, fontSize = 9.sp)
                    }
                    line.matchedVoucherId != null -> Text("کارمزد بانکی با سند دفترکل شماره " + line.matchedVoucherId + " ثبت و تطبیق شد.", color = Turquoise, fontSize = 10.sp)
                    else -> {
                        TextButton(onClick = { editingLine = line; showDialog = true }) { Text("ویرایش گردش", color = Turquoise) }
                        val options = candidates.filter { entry ->
                            (if (entry.kind == "RECEIPT") entry.amountRial else -entry.amountRial) == line.signedAmountRial
                        }
                        if (options.isNotEmpty()) {
                            val smartSuggestions = BankReconciliationMatcher.suggest(
                                line,
                                options.map { entry ->
                                    BankMatchCandidate(
                                        id = entry.id,
                                        title = "سند ${entry.id} • ${if (entry.kind == "RECEIPT") "دریافت" else "پرداخت"}",
                                        signedAmountRial = if (entry.kind == "RECEIPT") entry.amountRial else -entry.amountRial,
                                        reference = entry.referenceNumber,
                                        description = entry.note,
                                        dateEpoch = entry.createdAt
                                    )
                                }
                            )
                            smartSuggestions.take(2).forEach { suggestion ->
                                Column(
                                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                                        .background(Color(0x3329B6A8)).padding(10.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("پیشنهاد هوشمند: ${suggestion.candidate.title}", modifier = Modifier.weight(1f), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Text("امتیاز ${suggestion.score}/100", color = Turquoise, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    }
                                    Text(suggestion.reasons.joinToString(" • "), color = Muted, fontSize = 9.sp)
                                    TextButton(onClick = { onMatch(line.id, suggestion.candidate.id) }) {
                                        Text("تأیید و تطبیق این پیشنهاد", color = Turquoise)
                                    }
                                }
                            }
                            val labels = options.map { "سند " + it.id + " • " + (if (it.kind == "RECEIPT") "دریافت" else "پرداخت") + " • " + formatMoney(it.amountRial, showToman) }
                            ChoiceField("سند دریافت/پرداخت", options.firstOrNull { it.id == selectedEntryId }?.let { labels[options.indexOf(it)] } ?: "انتخاب سند", labels) { chosen ->
                                selectedEntryId = options.getOrNull(labels.indexOf(chosen))?.id
                            }
                            Button(onClick = { selectedEntryId?.let { onMatch(line.id, it) } }, enabled = selectedEntryId != null,
                                colors = ButtonDefaults.buttonColors(containerColor = Turquoise, contentColor = Navy)) { Text("تطبیق سند") }
                        }
                        val matchingChecks = clearedChecks.filter { check ->
                            (if (check.kind == "RECEIVED") check.amountRial else -check.amountRial) == line.signedAmountRial
                        }
                        if (matchingChecks.isNotEmpty()) {
                            val smartCheckSuggestions = BankReconciliationMatcher.suggest(
                                line,
                                matchingChecks.map { check ->
                                    BankMatchCandidate(
                                        id = check.id,
                                        title = "چک ${check.checkNumber}",
                                        signedAmountRial = if (check.kind == "RECEIVED") check.amountRial else -check.amountRial,
                                        reference = check.checkNumber,
                                        description = check.note,
                                        dateEpoch = check.dueDateEpoch
                                    )
                                }
                            )
                            smartCheckSuggestions.take(2).forEach { suggestion ->
                                Column(
                                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                                        .background(Color(0x3329B6A8)).padding(10.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("پیشنهاد هوشمند: ${suggestion.candidate.title}", modifier = Modifier.weight(1f), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Text("امتیاز ${suggestion.score}/100", color = Turquoise, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    }
                                    Text(suggestion.reasons.joinToString(" • "), color = Muted, fontSize = 9.sp)
                                    TextButton(onClick = { onMatchCheck(line.id, suggestion.candidate.id) }) {
                                        Text("تأیید و تطبیق این پیشنهاد", color = Turquoise)
                                    }
                                }
                            }
                            val labels = matchingChecks.map { "چک ${it.checkNumber} • ${formatMoney(it.amountRial, showToman)}" }
                            ChoiceField("چک وصول/پرداخت‌شده", matchingChecks.firstOrNull { it.id == selectedCheckId }?.let { labels[matchingChecks.indexOf(it)] } ?: "انتخاب چک", labels) { chosen ->
                                selectedCheckId = matchingChecks.getOrNull(labels.indexOf(chosen))?.id
                            }
                            Button(onClick = { selectedCheckId?.let { onMatchCheck(line.id, it) } }, enabled = selectedCheckId != null,
                                colors = ButtonDefaults.buttonColors(containerColor = Turquoise, contentColor = Navy)) { Text("تطبیق چک") }
                        }
                        if (options.isEmpty() && matchingChecks.isEmpty()) Text("سند یا چک تسویه‌شده هم‌مبلغ و هم‌جهت پیدا نشد.", color = Muted, fontSize = 10.sp)
                    }
                }
            }
        }
        Text("کارمزد بانکی به‌صورت هزینه بدهکار و بانک بستانکار در دفترکل ثبت می‌شود.", color = Muted, fontSize = 9.sp)
    }
    if (showPeriodDialog) BankStatementPeriodDialog(
        onDismiss = { showPeriodDialog = false },
        onSave = { bank, start, end, opening, closing ->
            onAddPeriod(bank, start, end, opening, closing)
            showPeriodDialog = false
        }
    )
    if (showDialog) BankStatementDialog(
        existing = editingLine,
        onDismiss = { showDialog = false; editingLine = null },
        onSave = { bank, date, amount, ref, description ->
            val current = editingLine
            if (current == null) onAdd(bank, date, amount, ref, description) { showDialog = false }
            else onEdit(current.id, bank, date, amount, ref, description) { showDialog = false; editingLine = null }
        }
    )
    if (showFeeDialog) BankFeeDialog(
        onDismiss = { showFeeDialog = false },
        onSave = { bank, date, amount, ref, description -> onAddFee(bank, date, amount, ref, description) { showFeeDialog = false } }
    )
}

@Composable
private fun BankCsvImportPreviewDialog(
    rows: List<BankStatementCsvRow>,
    bankName: String,
    onBankNameChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    val dateFormat = remember { java.text.SimpleDateFormat("yyyy/MM/dd", Locale.getDefault()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("پیش‌نمایش ورود گردش بانکی") },
        text = {
            Column(
                Modifier.fillMaxWidth().heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = bankName,
                    onValueChange = onBankNameChange,
                    label = { Text("نام بانک / حساب") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Text("تعداد ردیف‌های قابل ورود: ${rows.size}", color = Turquoise, fontWeight = FontWeight.Bold)
                Text("نمونه پنج گردش اول؛ مبالغ مثبت واریز و مبالغ منفی برداشت هستند. مبالغ فایل باید به ریال باشند.", color = Muted, fontSize = 10.sp)
                rows.take(5).forEach { row ->
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            "${dateFormat.format(java.util.Date(row.transactionDateEpoch))} • ${if (row.signedAmountRial >= 0) "واریز" else "برداشت"} • ${formatMoney(kotlin.math.abs(row.signedAmountRial), false)} ریال",
                            color = Color.White,
                            fontSize = 11.sp
                        )
                        if (row.bankReference.isNotBlank() || row.description.isNotBlank()) {
                            Text("${row.bankReference} ${row.description}".trim(), color = Muted, fontSize = 10.sp)
                        }
                    }
                    Divider(color = CardBorder)
                }
                Text("ردیف‌های تکراری بر اساس بانک، تاریخ، مبلغ، شماره مرجع و شرح شناسایی می‌شوند.", color = Muted, fontSize = 10.sp)
            }
        },
        confirmButton = {
            TextButton(enabled = bankName.isNotBlank(), onClick = onConfirm) { Text("ثبت گردش‌ها") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D),
        titleContentColor = Color.White,
        textContentColor = Color.White
    )
}

@Composable
private fun BankStatementPeriodDialog(
    onDismiss: () -> Unit,
    onSave: (String, Long, Long, Long, Long) -> Unit
) {
    var bank by remember { mutableStateOf("") }
    var startText by remember { mutableStateOf("") }
    var endText by remember { mutableStateOf("") }
    var openingText by remember { mutableStateOf("") }
    var closingText by remember { mutableStateOf("") }
    fun parseDate(value: String): Long? = runCatching {
        java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }.parse(value)?.time
    }.getOrNull()
    val start = parseDate(startText)
    val end = parseDate(endText)?.plus(86_399_999L)
    val opening = openingText.toLongOrNull()
    val closing = closingText.toLongOrNull()
    val valid = bank.isNotBlank() && start != null && end != null && end >= start &&
        opening != null && closing != null
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("ثبت دوره صورت‌حساب بانکی") },
        text = {
            Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                FormField("نام بانک / حساب", bank) { bank = it }
                FormField("از تاریخ (YYYY-MM-DD)", startText) { startText = it }
                FormField("تا تاریخ (YYYY-MM-DD)", endText) { endText = it }
                FormField("مانده افتتاحیه به ریال", openingText) { openingText = it }
                FormField("مانده اختتامیه طبق بانک به ریال", closingText) { closingText = it }
                Text("مانده محاسباتی از افتتاحیه به‌علاوه گردش‌های واردشده در بازه محاسبه و با مانده اعلامی بانک مقایسه می‌شود.", color = Muted, fontSize = 10.sp)
            }
        },
        confirmButton = { TextButton(enabled = valid, onClick = { onSave(bank.trim(), start!!, end!!, opening!!, closing!!) }) { Text("ثبت دوره") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}

@Composable
private fun BankFeeDialog(
    onDismiss: () -> Unit,
    onSave: (String, Long, Long, String, String) -> Unit
) {
    var bank by remember { mutableStateOf("") }
    var dateText by remember { mutableStateOf(java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).format(java.util.Date())) }
    var amountText by remember { mutableStateOf("") }
    var reference by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("کارمزد بانکی") }
    val date = runCatching { java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }.parse(dateText)?.time }.getOrNull() ?: 0L
    val amount = amountText.toLongOrNull() ?: 0L
    val valid = bank.isNotBlank() && date > 0L && amount > 0L
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("ثبت کارمزد بانکی") },
        text = {
            Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                FormField("نام بانک / حساب", bank) { bank = it }
                FormField("تاریخ کارمزد (YYYY-MM-DD)", dateText) { dateText = it }
                FormField("مبلغ کارمزد به ریال", amountText, KeyboardType.Number) { amountText = it }
                FormField("شماره پیگیری بانک", reference) { reference = it }
                FormField("شرح هزینه", description) { description = it }
                Text("ثبت این مورد یک سند دوبل ایجاد می‌کند: بدهکار هزینه کارمزد بانکی و بستانکار بانک.", color = Muted, fontSize = 10.sp)
            }
        },
        confirmButton = { TextButton(enabled = valid, onClick = { onSave(bank, date, amount, reference, description) }) { Text("ثبت کارمزد و سند") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}

@Composable
private fun BankStatementDialog(
    existing: BankStatementLineEntity? = null,
    onDismiss: () -> Unit,
    onSave: (String, Long, Long, String, String) -> Unit
) {
    var bank by remember(existing?.id) { mutableStateOf(existing?.bankName ?: "") }
    var dateText by remember(existing?.id) { mutableStateOf(java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).format(java.util.Date(existing?.transactionDateEpoch ?: System.currentTimeMillis()))) }
    var amountText by remember(existing?.id) { mutableStateOf(existing?.signedAmountRial?.toString() ?: "") }
    var reference by remember(existing?.id) { mutableStateOf(existing?.bankReference ?: "") }
    var description by remember(existing?.id) { mutableStateOf(existing?.description ?: "") }
    val date = runCatching { java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(dateText)?.time }.getOrNull() ?: 0L
    val amount = amountText.toLongOrNull() ?: 0L
    val valid = bank.isNotBlank() && date > 0L && amount != 0L
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) "ثبت گردش صورت‌حساب بانکی" else "ویرایش گردش بانکی") },
        text = {
            Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                FormField("نام بانک / حساب", bank) { bank = it }
                FormField("تاریخ گردش (YYYY-MM-DD)", dateText) { dateText = it }
                FormField("مبلغ به ریال (واریز مثبت، برداشت منفی)", amountText) { amountText = it }
                FormField("شماره پیگیری بانک", reference) { reference = it }
                FormField("شرح گردش", description) { description = it }
            }
        },
        confirmButton = { TextButton(enabled = valid, onClick = { onSave(bank, date, amount, reference, description) }) { Text("ثبت گردش") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}

@Composable
private fun ChecksScreen(
    checks: List<CheckEntity>, parties: List<PartyEntity>, showToman: Boolean,
    onAdd: (String, String, Long, Long, Long, Long, String, String, () -> Unit) -> Unit,
    onEdit: (Long, String, String, Long, Long, Long, Long, String, String, () -> Unit) -> Unit,
    onUpdateStatus: (Long, String) -> Unit
) {
    var showDialog by remember { mutableStateOf(false) }
    var editingCheck by remember { mutableStateOf<CheckEntity?>(null) }
    var searchText by remember { mutableStateOf("") }
    var pendingStatus by remember { mutableStateOf<Pair<CheckEntity, String>?>(null) }
    val visibleChecks = checks.filter { item ->
        val partyName = parties.firstOrNull { it.id == item.partyId }?.name.orEmpty()
        item.checkNumber.contains(searchText, true) || partyName.contains(searchText, true) ||
            item.bankName.contains(searchText, true) || item.note.contains(searchText, true) ||
            item.status.contains(searchText, true) || item.amountRial.toString().contains(searchText)
    }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        SectionHeader("مدیریت چک‌ها", "چک‌های دریافتی و پرداختی، سررسید و وضعیت وصول") { editingCheck = null; showDialog = true }
        FormField("جست‌وجوی شماره، طرف حساب، بانک، مبلغ یا وضعیت چک", searchText) { searchText = it }
        if (checks.isEmpty()) EmptyState("چکی ثبت نشده است", "چک‌های دریافتی مشتری و پرداختی تأمین‌کننده را ثبت کن")
        else if (visibleChecks.isEmpty()) EmptyState("چکی پیدا نشد", "عبارت جست‌وجو را تغییر بده یا پاک کن")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
            items(visibleChecks, key = { it.id }) { item ->
                val party = parties.firstOrNull { it.id == item.partyId }?.name ?: "طرف حساب"
                val dateKey = java.text.SimpleDateFormat("yyyyMMdd", Locale.US)
                val overdue = item.status == "OPEN" && dateKey.format(java.util.Date(item.dueDateEpoch)) < dateKey.format(java.util.Date())
                GlassCard {
                    Column {
                        Text((if (item.kind == "RECEIVED") "چک دریافتی • " else "چک پرداختی • ") + party, color = Color.White, fontWeight = FontWeight.Bold)
                        Text("شماره " + item.checkNumber + " • " + item.bankName, color = Muted, fontSize = 11.sp)
                        Text(formatMoney(item.amountRial, showToman) + " " + (if (showToman) "تومان" else "ریال"), color = Turquoise, fontWeight = FontWeight.Bold)
                        Text("سررسید: " + java.text.SimpleDateFormat("yyyy/MM/dd", Locale.getDefault()).format(java.util.Date(item.dueDateEpoch)), color = if (overdue) Color(0xFFFF9D9D) else Muted, fontSize = 11.sp)
                        Text(when (item.status) { "CLEARED" -> "وصول/پرداخت‌شده"; "BOUNCED" -> "برگشتی"; "CANCELLED" -> "باطل‌شده"; else -> if (overdue) "سررسید گذشته" else "باز" }, color = if (overdue) Color(0xFFFF9D9D) else Turquoise, fontSize = 11.sp)
                        if (item.status == "OPEN") Row {
                            TextButton(onClick = { editingCheck = item; showDialog = true }) { Text("ویرایش", color = Turquoise) }
                            TextButton(onClick = { pendingStatus = item to "CLEARED" }) { Text(if (item.kind == "RECEIVED") "وصول شد" else "پرداخت شد", color = Turquoise) }
                            TextButton(onClick = { pendingStatus = item to "BOUNCED" }) { Text("برگشتی", color = Color(0xFFFF9D9D)) }
                            TextButton(onClick = { pendingStatus = item to "CANCELLED" }) { Text("باطل شد", color = Muted) }
                        }
                    }
                }
            }
        }
    }
    if (showDialog) CheckDialog(parties, existing = editingCheck, onDismiss = { showDialog = false; editingCheck = null }, onSave = { a,b,c,d,e,f,g,h ->
        val current = editingCheck
        if (current == null) onAdd(a,b,c,d,e,f,g,h) { showDialog = false }
        else onEdit(current.id, a,b,c,d,e,f,g,h) { showDialog = false; editingCheck = null }
    })
    pendingStatus?.let { (item, status) ->
        val actionLabel = when (status) {
            "CLEARED" -> if (item.kind == "RECEIVED") "وصول" else "پرداخت"
            "BOUNCED" -> "برگشت"
            else -> "ابطال"
        }
        AlertDialog(
            onDismissRequest = { pendingStatus = null },
            title = { Text("تأیید تغییر وضعیت چک") },
            text = { Text("وضعیت چک ${item.checkNumber} به «$actionLabel» تغییر کند؟") },
            confirmButton = {
                TextButton(onClick = {
                    onUpdateStatus(item.id, status)
                    pendingStatus = null
                }) { Text("تأیید") }
            },
            dismissButton = { TextButton(onClick = { pendingStatus = null }) { Text("انصراف") } },
            containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
        )
    }
}

@Composable
private fun CheckDialog(
    parties: List<PartyEntity>, existing: CheckEntity? = null, onDismiss: () -> Unit,
    onSave: (String, String, Long, Long, Long, Long, String, String) -> Unit
) {
    val dateFormat = java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US)
    var number by remember(existing?.id) { mutableStateOf(existing?.checkNumber ?: "") }
    var kind by remember(existing?.id) { mutableStateOf(existing?.kind ?: "RECEIVED") }
    val eligible = parties.filter { if (kind == "RECEIVED") it.kind != "SUPPLIER" else it.kind != "CUSTOMER" }
    var partyId by remember(existing?.id) { mutableStateOf(existing?.partyId ?: eligible.firstOrNull()?.id ?: 0L) }
    var amount by remember(existing?.id) { mutableStateOf(existing?.amountRial?.toString() ?: "") }
    var issueDate by remember(existing?.id) { mutableStateOf(existing?.let { dateFormat.format(java.util.Date(it.issueDateEpoch)) } ?: dateFormat.format(java.util.Date())) }
    var dueDate by remember(existing?.id) { mutableStateOf(existing?.let { dateFormat.format(java.util.Date(it.dueDateEpoch)) } ?: issueDate) }
    var bank by remember(existing?.id) { mutableStateOf(existing?.bankName ?: "") }
    var note by remember(existing?.id) { mutableStateOf(existing?.note ?: "") }
    val issueAt = runCatching { dateFormat.parse(issueDate)?.time }.getOrNull() ?: 0L
    val dueAt = runCatching { dateFormat.parse(dueDate)?.time }.getOrNull() ?: 0L
    val valid = number.isNotBlank() && partyId > 0 && (amount.toLongOrNull() ?: 0L) > 0 && issueAt > 0 && dueAt >= issueAt
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text(if (existing == null) "ثبت چک" else "ویرایش چک " + existing.checkNumber) },
        text = {
            Column(Modifier.heightIn(max = 470.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = kind == "RECEIVED", onClick = { kind = "RECEIVED"; partyId = parties.firstOrNull { it.kind != "SUPPLIER" }?.id ?: 0L }, label = { Text("دریافتی") })
                    FilterChip(selected = kind == "PAYABLE", onClick = { kind = "PAYABLE"; partyId = parties.firstOrNull { it.kind != "CUSTOMER" }?.id ?: 0L }, label = { Text("پرداختی") })
                }
                FormField("شماره چک", number) { number = it }
                ChoiceField("طرف حساب", parties.firstOrNull { it.id == partyId }?.name ?: "انتخاب طرف حساب", eligible.map { it.name }) { name -> partyId = eligible.firstOrNull { it.name == name }?.id ?: 0L }
                FormField("مبلغ (ریال)", amount, KeyboardType.Number) { amount = it }
                FormField("تاریخ صدور (YYYY-MM-DD)", issueDate) { issueDate = it }
                FormField("تاریخ سررسید (YYYY-MM-DD)", dueDate) { dueDate = it }
                FormField("بانک", bank) { bank = it }
                FormField("توضیحات", note) { note = it }
                Text("ثبت چک به‌تنهایی به معنی وصول یا پرداخت وجه نیست.", color = Muted, fontSize = 10.sp)
            }
        },
        confirmButton = { TextButton(enabled = valid, onClick = { onSave(number, kind, partyId, amount.toLong(), issueAt, dueAt, bank, note) }) { Text(if (existing == null) "ثبت چک" else "ذخیره تغییرات") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}

@Composable
private fun HomeScreen(
    productCount: Int, partyCount: Int, invoiceCount: Int, voucherCount: Int, importCount: Int, showToman: Boolean,
    inventoryValueRial: Long, profitLoss: ir.billion.holloopro.data.ProfitLossRow, overdueChecks: Int,
    onLoadDemoData: () -> Unit
) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Box(
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF16415B), Color(0xFF10253D))))
                    .padding(20.dp)
            ) {
                Column {
                    Text("داشبورد کسب‌وکار", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(5.dp))
                    Text("موجودی، خرید، فروش و واردات در یک نگاه", color = Muted, fontSize = 12.sp)
                    Spacer(Modifier.height(16.dp))
                    Text("نسخه توسعه‌ای ۰٫۲", color = Turquoise, fontSize = 11.sp)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("کالاها", productCount.toString(), "▦", Modifier.weight(1f))
                StatCard("اشخاص", partyCount.toString(), "♙", Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("فاکتورها", invoiceCount.toString(), "▤", Modifier.weight(1f))
                StatCard("اسناد دوبل", voucherCount.toString(), "≋", Modifier.weight(1f))
            }
        }
        item { StatCard("سفارش‌های واردات", importCount.toString(), "▣", Modifier.fillMaxWidth()) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("ارزش موجودی", formatMoney(inventoryValueRial, showToman), "▦", Modifier.weight(1f))
                StatCard("فروش ثبت‌شده", formatMoney(profitLoss.salesRial, showToman), "↗", Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("سود ناخالص", formatMoney(profitLoss.salesRial - profitLoss.costOfGoodsSoldRial, showToman), "٪", Modifier.weight(1f))
                StatCard("چک سررسیدگذشته", overdueChecks.toString(), "◷", Modifier.weight(1f))
            }
        }
        item { OutlinedButton(onClick = onLoadDemoData, modifier = Modifier.fillMaxWidth()) { Text("بارگذاری داده‌های آزمایشی") } }
        item {
            GlassCard {
                Text("گردش کار پیشنهادی", color = Turquoise, fontWeight = FontWeight.Bold)
                Text("۱. کالا و اشخاص را تعریف کن", color = Color.White, fontSize = 13.sp)
                Text("۲. فاکتور خرید را ثبت کن تا موجودی افزایش یابد", color = Muted, fontSize = 12.sp)
                Text("۳. فاکتور فروش موجودی را کنترل و سند دوبل صادر می‌کند", color = Muted, fontSize = 12.sp)
                Text("۴. سفارش واردات، هزینه تمام‌شده هر کیلو را محاسبه می‌کند", color = Muted, fontSize = 12.sp)
            }
        }
        item {
            Text(
                if (showToman) "مبالغ در بخش‌های مالی به تومان نمایش داده می‌شوند؛ ذخیره‌سازی پایگاه داده ریال است."
                else "مبالغ به ریال نمایش داده می‌شوند.",
                color = Muted,
                fontSize = 11.sp
            )
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, symbol: String, modifier: Modifier = Modifier) {
    GlassCard(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(symbol, color = Turquoise, fontSize = 23.sp)
            Spacer(Modifier.width(10.dp))
            Column {
                Text(value, fontSize = 23.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Text(label, fontSize = 11.sp, color = Muted)
            }
        }
    }
}


@Composable
private fun WarehouseScreen(
    warehouses: List<WarehouseEntity>,
    warehouseStocks: List<WarehouseStockRow>,
    warehouseKardex: List<WarehouseKardexRow>,
    products: List<ProductWithStock>,
    showToman: Boolean,
    onCreate: (String, String, () -> Unit) -> Unit,
    onTransfer: (Long, Long, Long, Double, () -> Unit) -> Unit
) {
    var showCreate by remember { mutableStateOf(false) }
    var showTransfer by remember { mutableStateOf(false) }
    var searchText by remember { mutableStateOf("") }
    val visibleWarehouses = warehouses.filter { it.name.contains(searchText, true) || it.address.contains(searchText, true) }
    val visibleKardex = warehouseKardex.filter { it.productName.contains(searchText, true) || it.warehouseName.contains(searchText, true) || it.kind.contains(searchText, true) }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("مدیریت انبارها", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("موجودی مستقل هر انبار و انتقال با حفظ بهای میانگین", color = Muted, fontSize = 10.sp)
            }
            TextButton(onClick = { showTransfer = true }, enabled = warehouses.size > 1 && products.isNotEmpty()) { Text("انتقال کالا", color = Turquoise) }
            Button(onClick = { showCreate = true }, colors = ButtonDefaults.buttonColors(containerColor = Turquoise, contentColor = Navy)) { Text("انبار جدید") }
        }
        FormField("جست‌وجوی نام انبار، نشانی، کالا یا نوع گردش", searchText) { searchText = it }
        if (warehouses.isEmpty()) EmptyState("انبار تعریف نشده است", "ابتدا انبار اصلی را ایجاد کنید")
        else if (visibleWarehouses.isEmpty() && visibleKardex.isEmpty()) EmptyState("موردی پیدا نشد", "عبارت جست‌وجو را تغییر بده یا پاک کن")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
            items(visibleWarehouses, key = { it.id }) { warehouse ->
                val rows = warehouseStocks.filter { it.warehouseId == warehouse.id && it.quantityKg > 0.000001 }
                GlassCard {
                    Text(warehouse.name + if (warehouse.isDefault) " • پیش‌فرض" else "", color = Turquoise, fontWeight = FontWeight.Bold)
                    if (warehouse.address.isNotBlank()) Text(warehouse.address, color = Muted, fontSize = 10.sp)
                    if (rows.isEmpty()) Text("موجودی ثبت‌شده‌ای در این انبار وجود ندارد.", color = Muted, fontSize = 11.sp)
                    rows.forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(row.productName, color = Color.White, fontSize = 12.sp)
                                Text("${formatQuantity(row.quantityKg)} کیلوگرم", color = Muted, fontSize = 10.sp)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(formatMoney(row.valueRial, showToman), color = Turquoise, fontSize = 11.sp)
                                Text("میانگین ${formatMoney(row.averageCostPerKgRial, showToman)}", color = Muted, fontSize = 9.sp)
                            }
                        }
                    }
                }
            }
            item {
                GlassCard {
                    Text("کاردکس انبارها", color = Turquoise, fontWeight = FontWeight.Bold)
                    if (visibleKardex.isEmpty()) Text("گردش منطبق با جست‌وجو پیدا نشد.", color = Muted, fontSize = 11.sp)
                    visibleKardex.take(60).forEach { movement ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(movement.productName + " • " + movement.warehouseName, color = Color.White, fontSize = 11.sp)
                                Text(
                                    when (movement.kind) {
                                        "PURCHASE" -> "خرید"
                                        "SALE" -> "فروش"
                                        "IMPORT_RECEIPT" -> "رسید واردات"
                                        "STOCKTAKE_ADJUSTMENT" -> "اصلاح موجودی"
                                        "PARTIAL_RETURN" -> "برگشت جزئی"
                                        "REVERSAL" -> "برگشت فاکتور"
                                        "TRANSFER_IN" -> "انتقال ورودی"
                                        "TRANSFER_OUT" -> "انتقال خروجی"
                                        else -> movement.kind
                                    } + " • " + java.text.SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault()).format(java.util.Date(movement.createdAt)),
                                    color = Muted, fontSize = 9.sp
                                )
                            }
                            Text((if (movement.quantityKg > 0) "+" else "") + formatQuantity(movement.quantityKg) + " kg",
                                color = if (movement.quantityKg >= 0) Turquoise else Color(0xFFFFA4A4), fontSize = 11.sp)
                        }
                        Divider(color = CardBorder)
                    }
                }
            }
        }
    }
    if (showCreate) WarehouseCreateDialog(
        onDismiss = { showCreate = false },
        onSave = { name, address, done -> onCreate(name, address) { done(); showCreate = false } }
    )
    if (showTransfer) WarehouseTransferDialog(
        warehouses = warehouses, products = products, warehouseStocks = warehouseStocks,
        onDismiss = { showTransfer = false },
        onSave = { productId, sourceId, targetId, quantity, done ->
            onTransfer(productId, sourceId, targetId, quantity) { done(); showTransfer = false }
        }
    )
}

@Composable
private fun WarehouseCreateDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, () -> Unit) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("تعریف انبار جدید") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            FormField("نام انبار", name) { name = it }
            FormField("نشانی یا توضیح (اختیاری)", address) { address = it }
        } },
        confirmButton = { TextButton(enabled = name.isNotBlank(), onClick = { onSave(name, address) {} }) { Text("ثبت انبار") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}

@Composable
private fun WarehouseTransferDialog(
    warehouses: List<WarehouseEntity>,
    products: List<ProductWithStock>,
    warehouseStocks: List<WarehouseStockRow>,
    onDismiss: () -> Unit,
    onSave: (Long, Long, Long, Double, () -> Unit) -> Unit
) {
    var productId by remember { mutableStateOf(products.firstOrNull()?.product?.id ?: 0L) }
    var sourceId by remember { mutableStateOf(warehouses.firstOrNull()?.id ?: 0L) }
    var targetId by remember { mutableStateOf(warehouses.firstOrNull { it.id != sourceId }?.id ?: 0L) }
    var quantity by remember { mutableStateOf("") }
    val available = warehouseStocks.firstOrNull { it.warehouseId == sourceId && it.productId == productId }?.quantityKg ?: 0.0
    val quantityValue = quantity.replace(',', '.').toDoubleOrNull() ?: 0.0
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("انتقال بین انبارها") },
        text = { Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ChoiceField("کالا", products.firstOrNull { it.product.id == productId }?.product?.name ?: "انتخاب کالا", products.map { it.product.name }) {
                productId = products.firstOrNull { p -> p.product.name == it }?.product?.id ?: 0L
            }
            ChoiceField("انبار مبدأ", warehouses.firstOrNull { it.id == sourceId }?.name ?: "انتخاب", warehouses.map { it.name }) {
                sourceId = warehouses.firstOrNull { w -> w.name == it }?.id ?: 0L
                if (sourceId == targetId) targetId = warehouses.firstOrNull { w -> w.id != sourceId }?.id ?: 0L
            }
            ChoiceField("انبار مقصد", warehouses.firstOrNull { it.id == targetId }?.name ?: "انتخاب", warehouses.filter { it.id != sourceId }.map { it.name }) {
                targetId = warehouses.firstOrNull { w -> w.name == it }?.id ?: 0L
            }
            Text("موجودی مبدأ: ${formatQuantity(available)} کیلوگرم", color = Muted, fontSize = 11.sp)
            FormField("مقدار انتقال (کیلوگرم)", quantity, KeyboardType.Decimal) { quantity = it.filter { ch -> ch.isDigit() || ch == '.' || ch == ',' } }
        } },
        confirmButton = {
            TextButton(enabled = productId > 0 && sourceId > 0 && targetId > 0 && sourceId != targetId && quantityValue > 0 && quantityValue <= available + 0.000001,
                onClick = { onSave(productId, sourceId, targetId, quantityValue) {} }) { Text("ثبت انتقال") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}

@Composable
private fun InventoryScreen(
    warehouses: List<WarehouseEntity>, warehouseStocks: List<WarehouseStockRow>, products: List<ProductWithStock>, showToman: Boolean,
    onSave: (Long?, String, String, String, String, String, Int, Boolean, String) -> Unit,
    onDelete: (Long) -> Unit,
    onSetOpeningValuation: (Long, Long, Long) -> Unit,
    onAdjustStock: (Long, Double, Long, Long) -> Unit
) {
    var dialog by remember { mutableStateOf(false) }
    var valuationProduct by remember { mutableStateOf<ProductWithStock?>(null) }
    var adjustmentProduct by remember { mutableStateOf<ProductWithStock?>(null) }
    var editing by remember { mutableStateOf<ProductEntity?>(null) }
    var searchText by remember { mutableStateOf("") }
    val visibleProducts = remember(products, searchText) { filterProducts(products, searchText) }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        SectionHeader("کالا و انبار", "تعریف، ویرایش و کنترل موجودی کالاهای نخ") { editing = null; dialog = true }
        FormField("جست‌وجوی کد، نام، گروه، نوع نخ، دنیر یا رنگ", searchText) { searchText = it }
        if (products.isEmpty()) EmptyState("هنوز کالایی ثبت نشده است", "برای شروع، کالای نخ جدید اضافه کن")
        else if (visibleProducts.isEmpty()) EmptyState("کالایی پیدا نشد", "عبارت جست‌وجو را تغییر بده یا پاک کن")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
            items(visibleProducts, key = { it.product.id }) { item ->
                GlassCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(item.product.name, color = Color.White, fontWeight = FontWeight.Bold)
                            Text("${item.product.sku}  •  ${item.product.yarnType}  •  ${item.product.denier}D", color = Muted, fontSize = 11.sp)
                            Text("${item.product.groupName}  •  ${item.product.color}  •  ${if (item.product.twisted) "تاب‌دار" else "بدون‌تاب"}", color = Muted, fontSize = 11.sp)
                            Text("موجودی: ${formatQuantity(item.stockKg)} کیلوگرم", color = Turquoise, fontSize = 13.sp)
                            if (item.inventoryValueRial > 0) {
                                Text("ارزش موجودی: ${formatMoney(item.inventoryValueRial, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Color.White, fontSize = 11.sp)
                                Text("میانگین بهای هر کیلو: ${formatMoney(item.averageCostPerKgRial, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Muted, fontSize = 10.sp)
                            } else if (item.stockKg > 0.000001) {
                                Text("بهای موجودی قدیمی ثبت نشده", color = Color(0xFFFFC078), fontSize = 10.sp)
                                TextButton(onClick = { valuationProduct = item }) { Text("ثبت بهای افتتاحیه", color = Turquoise) }
                            }
                        }
                        Column {
                            TextButton(onClick = { adjustmentProduct = item }) { Text("اصلاح موجودی", color = Turquoise) }
                            TextButton(onClick = { editing = item.product; dialog = true }) { Text("ویرایش", color = Turquoise) }
                            TextButton(onClick = { onDelete(item.product.id) }) { Text("حذف", color = Color(0xFFFF9D9D)) }
                        }
                    }
                }
            }
        }
    }
    if (dialog) ProductDialog(existing = editing, onDismiss = { dialog = false; editing = null }, onSave = { id,a,b,c,d,e,f,g,h -> onSave(id,a,b,c,d,e,f,g,h); dialog = false; editing = null })
    valuationProduct?.let { item -> OpeningValuationDialog(
        product = item, warehouses = warehouses, warehouseStocks = warehouseStocks,
        showToman = showToman,
        onDismiss = { valuationProduct = null },
        onSave = { costPerKgRial, warehouseId -> onSetOpeningValuation(item.product.id, costPerKgRial, warehouseId); valuationProduct = null }
    ) }
    adjustmentProduct?.let { item -> StockAdjustmentDialog(
        product = item, warehouses = warehouses, warehouseStocks = warehouseStocks,
        showToman = showToman,
        onDismiss = { adjustmentProduct = null },
        onSave = { deltaKg, costPerKgRial, warehouseId ->
            onAdjustStock(item.product.id, deltaKg, costPerKgRial, warehouseId)
            adjustmentProduct = null
        }
    ) }
}


@Composable
private fun StockAdjustmentDialog(
    product: ProductWithStock,
    warehouses: List<WarehouseEntity>, warehouseStocks: List<WarehouseStockRow>,
    showToman: Boolean,
    onDismiss: () -> Unit,
    onSave: (Double, Long, Long) -> Unit
) {
    var warehouseId by remember(product.product.id) { mutableStateOf(warehouses.firstOrNull()?.id ?: 1L) }
    var quantity by remember(product.product.id) { mutableStateOf("") }
    var increase by remember(product.product.id) { mutableStateOf(true) }
    var cost by remember(product.product.id) { mutableStateOf("") }
    val quantityValue = quantity.replace(',', '.').toDoubleOrNull() ?: 0.0
    val costValue = (cost.toBigDecimalOrNull() ?: BigDecimal.ZERO)
        .multiply(if (showToman) BigDecimal.TEN else BigDecimal.ONE)
        .setScale(0, java.math.RoundingMode.HALF_UP).toLong()
    val delta = if (increase) quantityValue else -quantityValue
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("اصلاح موجودی / انبارگردانی") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(product.product.name, color = Color.White, fontWeight = FontWeight.Bold)
                ChoiceField("انبار", warehouses.firstOrNull { it.id == warehouseId }?.name ?: "انبار اصلی", warehouses.map { it.name }) { selected -> warehouseId = warehouses.firstOrNull { it.name == selected }?.id ?: 1L }
                val warehouseStock = warehouseStocks.firstOrNull { it.warehouseId == warehouseId && it.productId == product.product.id }?.quantityKg ?: 0.0
                Text("موجودی فعلی در این انبار: ${formatQuantity(warehouseStock)} کیلوگرم", color = Muted)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = increase, onClick = { increase = true }, label = { Text("افزایش") })
                    FilterChip(selected = !increase, onClick = { increase = false }, label = { Text("کاهش") })
                }
                FormField("مقدار اصلاح (کیلوگرم)", quantity, KeyboardType.Decimal) { quantity = it }
                if (increase) {
                    FormField("بهای هر کیلو (${if (showToman) "تومان" else "ریال"})", cost, KeyboardType.Number) { cost = it }
                } else {
                    Text("برای کاهش، بهای میانگین فعلی موجودی مبنای ثبت کسری قرار می‌گیرد.", color = Muted, fontSize = 10.sp)
                }
                Text("موجودی پس از اصلاح: ${formatQuantity(warehouseStock + delta)} کیلوگرم", color = Turquoise)
                if (warehouseStock + delta < -0.000001) Text("موجودی نمی‌تواند منفی شود.", color = Color(0xFFFF9D9D), fontSize = 10.sp)
            }
        },
        confirmButton = {
            TextButton(
                enabled = quantityValue.isFinite() && quantityValue > 0.0 &&
                    (warehouseStocks.firstOrNull { it.warehouseId == warehouseId && it.productId == product.product.id }?.quantityKg ?: 0.0) + delta >= -0.000001 &&
                    (if (increase) costValue > 0 else (warehouseStocks.firstOrNull { it.warehouseId == warehouseId && it.productId == product.product.id }?.valueRial ?: 0L) > 0),
                onClick = { onSave(delta, costValue, warehouseId) }
            ) { Text("ثبت اصلاح") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}

@Composable
private fun OpeningValuationDialog(
    product: ProductWithStock,
    warehouses: List<WarehouseEntity>, warehouseStocks: List<WarehouseStockRow>,
    showToman: Boolean,
    onDismiss: () -> Unit,
    onSave: (Long, Long) -> Unit
) {
    var warehouseId by remember(product.product.id) { mutableStateOf(warehouses.firstOrNull()?.id ?: 1L) }
    var cost by remember(product.product.id) { mutableStateOf("") }
    val costRial = (cost.toBigDecimalOrNull() ?: BigDecimal.ZERO)
        .multiply(if (showToman) BigDecimal.TEN else BigDecimal.ONE)
        .setScale(0, java.math.RoundingMode.HALF_UP).toLong()
    val estimatedValue = runCatching {
        BigDecimal.valueOf(warehouseStocks.firstOrNull { it.warehouseId == warehouseId && it.productId == product.product.id }?.quantityKg ?: 0.0).multiply(BigDecimal.valueOf(costRial))
            .setScale(0, java.math.RoundingMode.HALF_UP).longValueExact()
    }.getOrDefault(0L)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("بهای افتتاحیه موجودی") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(product.product.name, color = Color.White, fontWeight = FontWeight.Bold)
                ChoiceField("انبار", warehouses.firstOrNull { it.id == warehouseId }?.name ?: "انبار اصلی", warehouses.map { it.name }) { selected -> warehouseId = warehouses.firstOrNull { it.name == selected }?.id ?: 1L }
                val warehouseStock = warehouseStocks.firstOrNull { it.warehouseId == warehouseId && it.productId == product.product.id }?.quantityKg ?: 0.0
                Text("موجودی فعلی در این انبار: ${formatQuantity(warehouseStock)} کیلوگرم", color = Muted)
                FormField("بهای هر کیلو (${if (showToman) "تومان" else "ریال"})", cost, KeyboardType.Number) { cost = it }
                Text("ارزش افتتاحیه: ${formatMoney(estimatedValue, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Turquoise)
                Text("این مبلغ مبنای محاسبه بهای تمام‌شده فروش‌های بعدی است. آن را بر اساس بهای واقعی موجودی در ابتدای استفاده وارد کن.", color = Muted, fontSize = 10.sp)
            }
        },
        confirmButton = { TextButton(enabled = costRial > 0 && estimatedValue > 0, onClick = { onSave(costRial, warehouseId) }) { Text("ثبت ارزش موجودی") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}

@Composable
private fun PartiesScreen(
    parties: List<PartyEntity>, balances: List<ir.billion.holloopro.data.PartyBalanceRow>, showToman: Boolean,
    onSave: (Long?, String, String, String, String, Long) -> Unit, onDelete: (Long) -> Unit,
    onPartyLedger: (Long) -> Flow<List<ir.billion.holloopro.data.PartyLedgerRow>>
) {
    var dialog by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<PartyEntity?>(null) }
    var searchText by remember { mutableStateOf("") }
    val visibleParties = parties.filter { it.name.contains(searchText, true) || it.phone.contains(searchText, true) || it.address.contains(searchText, true) || partyKind(it.kind).contains(searchText, true) || it.id.toString().contains(searchText) }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        SectionHeader("اشخاص و طرف حساب", "ثبت، ویرایش و مشاهده مانده مشتری و تأمین‌کننده") { editing = null; dialog = true }
        FormField("جست‌وجوی نام، کد، تلفن، نشانی یا نوع طرف حساب", searchText) { searchText = it }
        if (parties.isEmpty()) EmptyState("فهرست اشخاص خالی است", "مشتری‌ها و تأمین‌کنندگان را ثبت کن")
        else if (visibleParties.isEmpty()) EmptyState("طرف حسابی پیدا نشد", "عبارت جست‌وجو را تغییر بده یا پاک کن")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
            items(visibleParties, key = { it.id }) { party ->
                GlassCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(party.name, color = Color.White, fontWeight = FontWeight.Bold)
                            Text(partyKind(party.kind), color = Turquoise, fontSize = 11.sp)
                            if (party.phone.isNotBlank()) Text(party.phone, color = Muted, fontSize = 12.sp)
                            if (party.address.isNotBlank()) Text(party.address, color = Muted, fontSize = 11.sp)
                            val balance = balances.firstOrNull { it.partyId == party.id }?.balanceRial ?: party.openingBalanceRial
                            Text("مانده جاری: ${formatMoney(balance, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Turquoise, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            Text("مانده افتتاحیه: ${formatMoney(party.openingBalanceRial, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Muted, fontSize = 10.sp)
                            var showHistory by remember(party.id) { mutableStateOf(false) }
                            val partyRows by onPartyLedger(party.id).collectAsState(initial = emptyList())
                            TextButton(onClick = { showHistory = !showHistory }) { Text(if (showHistory) "بستن گردش حساب" else "مشاهده ریز گردش حساب", color = Turquoise) }
                            if (showHistory) {
                                if (partyRows.isEmpty()) Text("برای این شخص گردش ثبت‌شده‌ای وجود ندارد.", color = Muted, fontSize = 10.sp)
                                else {
                                    var runningBalance = party.openingBalanceRial
                                    val statementRows = partyRows.sortedBy { it.createdAt }.map { row ->
                                        runningBalance = Math.addExact(runningBalance, Math.subtractExact(row.debitRial, row.creditRial))
                                        row to runningBalance
                                    }
                                    Text("مانده ابتدای گردش: ${formatMoney(party.openingBalanceRial, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Muted, fontSize = 10.sp)
                                    statementRows.forEach { (row, balanceAfter) ->
                                        Divider(color = CardBorder)
                                        Text(row.description, color = Color.White, fontSize = 10.sp)
                                        Text("بدهکار ${formatMoney(row.debitRial, showToman)}  |  بستانکار ${formatMoney(row.creditRial, showToman)}", color = Turquoise, fontSize = 10.sp)
                                        Text("مانده پس از گردش: ${formatMoney(balanceAfter, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Color(0xFF9BDDD4), fontSize = 10.sp)
                                        Text(java.text.SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault()).format(java.util.Date(row.createdAt)), color = Muted, fontSize = 9.sp)
                                    }
                                }
                            }
                        }
                        Column {
                            TextButton(onClick = { editing = party; dialog = true }) { Text("ویرایش", color = Turquoise) }
                            TextButton(onClick = { onDelete(party.id) }) { Text("حذف", color = Color(0xFFFF9D9D)) }
                        }
                    }
                }
            }
        }
    }
    if (dialog) PartyDialog(existing = editing, onDismiss = { dialog = false; editing = null }, onSave = { id,a,b,c,d,e -> onSave(id,a,b,c,d,e); dialog = false; editing = null })
}

@Composable
private fun InvoicesScreen(
    warehouses: List<WarehouseEntity>, parties: List<PartyEntity>, products: List<ProductWithStock>, invoices: List<InvoiceEntity>,
    settlements: List<InvoiceSettlementRow>, returnTotals: List<InvoiceReturnSummaryRow>, returnableLines: List<ReturnableInvoiceLineRow>, settlementDetails: List<ir.billion.holloopro.data.InvoiceSettlementDetailRow>, treasury: List<TreasuryEntryEntity>, treasuryAllocations: List<TreasuryAllocationRow>, showToman: Boolean,
    onCreate: (String, Long, List<InvoiceLineInput>, Long, Long, Long, Long, () -> Unit) -> Unit,
    onEdit: (Long, Long, List<InvoiceLineInput>, Long, Long, Long, Long, () -> Unit) -> Unit,
    onShare: (InvoiceEntity, PartyEntity?, List<ReturnableInvoiceLineRow>, String) -> Unit,
    onReverse: (Long) -> Unit, onPartialReturn: (Long, List<InvoiceReturnLineInput>, String, () -> Unit) -> Unit, onAllocate: (Long, Long, Long, () -> Unit) -> Unit,
    onRemoveSettlement: (Long, () -> Unit) -> Unit
) {
    var dialog by remember { mutableStateOf(false) }
    var editingInvoice by remember { mutableStateOf<InvoiceEntity?>(null) }
    var allocationTarget by remember { mutableStateOf<InvoiceEntity?>(null) }
    var returnTarget by remember { mutableStateOf<InvoiceEntity?>(null) }
    var expandedSettlementInvoice by remember { mutableStateOf<Long?>(null) }
    var settlementToRemove by remember { mutableStateOf<ir.billion.holloopro.data.InvoiceSettlementDetailRow?>(null) }
    var searchText by remember { mutableStateOf("") }
    val visibleInvoices = invoices.filter { invoice ->
        val partyName = parties.firstOrNull { it.id == invoice.partyId }?.name.orEmpty()
        invoice.number.contains(searchText, true) || partyName.contains(searchText, true) ||
            invoice.note.contains(searchText, true) || invoice.kind.contains(searchText, true) ||
            invoice.status.contains(searchText, true) || invoice.totalRial.toString().contains(searchText)
    }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        SectionHeader("فاکتور خرید و فروش", "صدور، ویرایش، PDF و تسویه مرحله‌ای") { editingInvoice = null; dialog = true }
        FormField("جست‌وجوی شماره، مشتری، مبلغ، نوع یا وضعیت فاکتور", searchText) { searchText = it }
        if (invoices.isEmpty()) EmptyState("فاکتوری ثبت نشده است", "برای ثبت خرید یا فروش، فاکتور جدید بساز")
        else if (visibleInvoices.isEmpty()) EmptyState("فاکتوری پیدا نشد", "عبارت جست‌وجو را تغییر بده یا پاک کن")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
            items(visibleInvoices, key = { it.id }) { invoice ->
                val partyName = parties.firstOrNull { it.id == invoice.partyId }?.name ?: "طرف حساب"
                val paid = settlements.firstOrNull { it.invoiceId == invoice.id }?.paidRial ?: 0L
                val returned = returnTotals.firstOrNull { it.invoiceId == invoice.id }?.returnedRial ?: 0L
                val remaining = (invoice.totalRial - paid - returned).coerceAtLeast(0L)
                GlassCard {
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(if (invoice.kind == "SALE") "فروش به $partyName" else "خرید از $partyName", color = Color.White, fontWeight = FontWeight.Bold)
                                Text(invoice.number, color = Muted, fontSize = 10.sp)
                                Text("انبار: ${warehouses.firstOrNull { it.id == invoice.warehouseId }?.name ?: "انبار اصلی"}", color = Muted, fontSize = 9.sp)
                            }
                            Text(when (invoice.status) { "POSTED" -> "ثبت‌شده"; "EDITED" -> "ویرایش‌شده"; else -> "برگشت‌شده" }, color = Muted, fontSize = 11.sp)
                        }
                        Text("مبلغ فاکتور: ${formatMoney(invoice.totalRial, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Color.White)
                        Text("تسویه‌شده: ${formatMoney(paid, showToman)}  •  برگشتی: ${formatMoney(returned, showToman)}", color = Muted, fontSize = 11.sp)
                        Text("مانده: ${formatMoney(remaining, showToman)} ${if (showToman) "تومان" else "ریال"}", color = if (remaining == 0L) Turquoise else Color(0xFFFFC47A), fontSize = 12.sp)
                        val invoiceDetails = settlementDetails.filter { it.invoiceId == invoice.id }
                        if (invoiceDetails.isNotEmpty()) {
                            TextButton(onClick = {
                                expandedSettlementInvoice = if (expandedSettlementInvoice == invoice.id) null else invoice.id
                            }) { Text(if (expandedSettlementInvoice == invoice.id) "بستن ریز تسویه" else "مشاهده ریز تسویه") }
                            if (expandedSettlementInvoice == invoice.id) {
                                invoiceDetails.forEach { detail ->
                                    val date = java.text.SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault())
                                        .format(java.util.Date(detail.createdAt))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Column(Modifier.weight(1f)) {
                                            Text(
                                                "${if (detail.entryKind == "RECEIPT") "دریافت" else "پرداخت"} • ${detail.referenceNumber.ifBlank { "بدون شماره" }} • ${if (detail.method == "BANK") "بانک" else "نقد"}",
                                                color = Muted, fontSize = 11.sp
                                            )
                                            Text(
                                                "${formatMoney(detail.amountRial, showToman)} ${if (showToman) "تومان" else "ریال"} • تاریخ تخصیص: $date",
                                                color = Turquoise, fontSize = 11.sp
                                            )
                                        }
                                        TextButton(onClick = { settlementToRemove = detail }) {
                                            Text("لغو تخصیص", color = Color(0xFFFFA4A4), fontSize = 11.sp)
                                        }
                                    }
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            OutlinedButton(onClick = {
                                onShare(invoice, parties.firstOrNull { it.id == invoice.partyId }, returnableLines.filter { it.invoiceId == invoice.id }, warehouses.firstOrNull { it.id == invoice.warehouseId }?.name ?: "انبار اصلی")
                            }) { Text("PDF / ارسال") }
                            if (invoice.status == "POSTED" && paid == 0L && returned == 0L) {
                                OutlinedButton(onClick = { editingInvoice = invoice; dialog = true }) { Text("ویرایش") }
                            }
                        }
                        if (invoice.status == "POSTED") {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (remaining > 0L) OutlinedButton(onClick = { allocationTarget = invoice }) { Text("تخصیص دریافت/پرداخت") }
                                if (returnableLines.any { it.invoiceId == invoice.id && it.originalQuantityKg - it.returnedQuantityKg > 0.000001 }) OutlinedButton(onClick = { returnTarget = invoice }) { Text("برگشت جزئی") }
                                if (paid == 0L && returned == 0L) TextButton(onClick = { onReverse(invoice.id) }) { Text("برگشت کامل", color = Color(0xFFFFA4A4)) }
                                else Text("برای برگشت کامل، ابتدا تخصیص‌ها و برگشت‌های جزئی را بررسی کن", color = Muted, fontSize = 10.sp)
                            }
                        }
                    }
                }
            }
        }
    }
    if (dialog) InvoiceDialog(warehouses, parties, products, existing = editingInvoice, existingLines = editingInvoice?.let { invoice -> returnableLines.filter { it.invoiceId == invoice.id } } ?: emptyList(), onDismiss = { dialog = false; editingInvoice = null }, onSave = { kind, partyId, lines, discount, tax, extraCosts, warehouseId ->
        val current = editingInvoice
        if (current == null) onCreate(kind, partyId, lines, discount, tax, extraCosts, warehouseId) { dialog = false }
        else onEdit(current.id, partyId, lines, discount, tax, extraCosts, warehouseId) { dialog = false; editingInvoice = null }
    })
    allocationTarget?.let { invoice ->
        InvoiceAllocationDialog(
            invoice = invoice, party = parties.firstOrNull { it.id == invoice.partyId},
            settlements = settlements, returnTotals = returnTotals, treasury = treasury, treasuryAllocations = treasuryAllocations, showToman = showToman,
            onDismiss = { allocationTarget = null },
            onAllocate = { entryId, amount, onSuccess -> onAllocate(entryId, invoice.id, amount, onSuccess) }
        )
    }
    returnTarget?.let { invoice ->
        InvoiceReturnDialog(invoice, returnableLines.filter { it.invoiceId == invoice.id }, showToman,
            onDismiss = { returnTarget = null },
            onSave = { rows, note, onSuccess -> onPartialReturn(invoice.id, rows, note) { onSuccess(); returnTarget = null } })
    }
    settlementToRemove?.let { settlement ->
        AlertDialog(
            onDismissRequest = { settlementToRemove = null },
            title = { Text("لغو تخصیص تسویه") },
            text = { Text("مبلغ ${formatMoney(settlement.amountRial, showToman)} ${if (showToman) "تومان" else "ریال"} از تخصیص این رسید آزاد می‌شود. سند دریافت/پرداخت حذف نمی‌شود. ادامه می‌دهی؟") },
            confirmButton = {
                TextButton(onClick = {
                    onRemoveSettlement(settlement.settlementId) { settlementToRemove = null }
                }) { Text("بله، لغو شود", color = Color(0xFFFFA4A4)) }
            },
            dismissButton = { TextButton(onClick = { settlementToRemove = null }) { Text("انصراف") } },
            containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
        )
    }
}

@Composable
private fun InvoiceAllocationDialog(
    invoice: InvoiceEntity, party: PartyEntity?, settlements: List<InvoiceSettlementRow>, returnTotals: List<InvoiceReturnSummaryRow>,
    treasury: List<TreasuryEntryEntity>, treasuryAllocations: List<TreasuryAllocationRow>, showToman: Boolean,
    onDismiss: () -> Unit, onAllocate: (Long, Long, () -> Unit) -> Unit
) {
    var selectedEntry by remember(invoice.id) { mutableStateOf(0L) }
    var amountText by remember(invoice.id) { mutableStateOf("") }
    val paid = settlements.firstOrNull { it.invoiceId == invoice.id }?.paidRial ?: 0L
    val returned = returnTotals.firstOrNull { it.invoiceId == invoice.id }?.returnedRial ?: 0L
    val invoiceRemaining = (invoice.totalRial - paid - returned).coerceAtLeast(0L)
    val expectedKind = if (invoice.kind == "SALE") "RECEIPT" else "PAYMENT"
    val candidates = treasury.filter { it.partyId == invoice.partyId && it.kind == expectedKind }
    val used = selectedEntry.takeIf { it > 0L }?.let { id -> treasury.firstOrNull { it.id == id } }
    val entryAllocated = used?.let { entry -> treasuryAllocations.firstOrNull { it.entryId == entry.id }?.allocatedRial ?: 0L } ?: 0L
    val amount = amountText.toLongOrNull()?.let { value -> runCatching { if (showToman) Math.multiplyExact(value, 10L) else value }.getOrNull() }
    val entryRemaining = used?.let { entry -> (entry.amountRial - entryAllocated).coerceAtLeast(0L) } ?: 0L
    val valid = selectedEntry > 0L && amount != null && amount > 0L && amount <= invoiceRemaining && amount <= entryRemaining
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("تخصیص به ${invoice.number}") },
        text = {
            Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text("مانده فاکتور: ${formatMoney(invoiceRemaining, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Turquoise)
                Text("طرف حساب: ${party?.name ?: "نامشخص"}", color = Muted, fontSize = 12.sp)
                if (candidates.isEmpty()) Text("برای این طرف حساب هنوز دریافت/پرداختی ثبت نشده است. ابتدا از بخش حسابداری یک رسید ثبت کن.", color = Color(0xFFFFC47A), fontSize = 12.sp)
                else {
                    Text("رسید دریافت/پرداخت", color = Color.White, fontWeight = FontWeight.Bold)
                    candidates.forEach { entry ->
                        val selected = selectedEntry == entry.id
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                                .background(if (selected) Color(0x4436D6C5) else Color(0x22102030))
                                .clickable { selectedEntry = entry.id }.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(selected = selected, onClick = { selectedEntry = entry.id })
                            Column(Modifier.weight(1f)) {
                                Text("${if (entry.kind == "RECEIPT") "دریافت" else "پرداخت"} • ${entry.referenceNumber.ifBlank { "بدون شماره" }}", color = Color.White)
                                val allocated = treasuryAllocations.firstOrNull { it.entryId == entry.id }?.allocatedRial ?: 0L
                                val remaining = (entry.amountRial - allocated).coerceAtLeast(0L)
                                Text("مانده قابل تخصیص: ${formatMoney(remaining, showToman)} ${if (showToman) "تومان" else "ریال"} • ${entry.note}", color = Muted, fontSize = 10.sp)
                            }
                        }
                    }
                    FormField("مبلغ تخصیص ${if (showToman) "(تومان)" else "(ریال)"}", amountText, KeyboardType.Number) { amountText = it.filter(Char::isDigit) }
                    Text("می‌توانی با چند رسید، این فاکتور را مرحله‌ای تسویه کنی.", color = Muted, fontSize = 10.sp)
                }
            }
        },
        confirmButton = { TextButton(enabled = valid, onClick = { onAllocate(selectedEntry, amount!!) { onDismiss() } }) { Text("ثبت تخصیص") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("بستن") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}


@Composable
private fun InvoiceReturnDialog(
    invoice: InvoiceEntity,
    lines: List<ReturnableInvoiceLineRow>,
    showToman: Boolean,
    onDismiss: () -> Unit,
    onSave: (List<InvoiceReturnLineInput>, String, () -> Unit) -> Unit
) {
    val quantities = remember(invoice.id) { mutableStateMapOf<Long, String>() }
    var note by remember(invoice.id) { mutableStateOf("") }
    val eligible = lines.filter { it.originalQuantityKg - it.returnedQuantityKg > 0.000001 }
    val selected = eligible.mapNotNull { line ->
        val quantity = quantities[line.invoiceLineId]?.toDoubleOrNull() ?: 0.0
        val remaining = line.originalQuantityKg - line.returnedQuantityKg
        if (quantity > 0.0 && quantity <= remaining + 0.000001)
            InvoiceReturnLineInput(line.invoiceLineId, quantity) else null
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("برگشت جزئی • ${invoice.number}") },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text("مقدار برگشتی را برای هر کالا وارد کن. موجودی و سند حسابداری متناسب با مقدار برگشتی اصلاح می‌شود.", color = Muted, fontSize = 11.sp)
                eligible.forEach { line ->
                    val remaining = (line.originalQuantityKg - line.returnedQuantityKg).coerceAtLeast(0.0)
                    GlassCard {
                        Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text(line.productName, color = Color.White, fontWeight = FontWeight.Bold)
                            Text("فاکتور: ${formatQuantity(line.originalQuantityKg)} کیلو • برگشتی: ${formatQuantity(line.returnedQuantityKg)} • باقی‌مانده: ${formatQuantity(remaining)}", color = Muted, fontSize = 10.sp)
                            FormField("مقدار برگشتی (کیلوگرم)", quantities[line.invoiceLineId] ?: "", KeyboardType.Decimal) {
                                quantities[line.invoiceLineId] = it.filter { ch -> ch.isDigit() || ch == '.' }
                            }
                        }
                    }
                }
                FormField("شرح برگشت (اختیاری)", note) { note = it }
            }
        },
        confirmButton = {
            TextButton(enabled = selected.isNotEmpty(), onClick = { onSave(selected, note) {} }) { Text("ثبت برگشت") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}

@Composable
private fun ImportsScreen(
    products: List<ProductWithStock>, parties: List<PartyEntity>, imports: List<ImportOrderEntity>, showToman: Boolean,
    onAdd: (Long, String, Long, String, Double, Long, Long, Long, Long, Int, () -> Unit) -> Unit,
    onEdit: (Long, Long, String, Long, String, Double, Long, Long, Long, Long, Int, () -> Unit) -> Unit,
    onReceive: (Long, List<ImportReceiptLineInput>, () -> Unit) -> Unit
) {
    var dialog by remember { mutableStateOf(false) }
    var editingOrder by remember { mutableStateOf<ImportOrderEntity?>(null) }
    var receivingOrder by remember { mutableStateOf<ImportOrderEntity?>(null) }
    var searchText by remember { mutableStateOf("") }
    val visibleImports = imports.filter { order ->
        val supplier = parties.firstOrNull { it.id == order.supplierId }?.name.orEmpty()
        order.containerCode.contains(searchText, true) || supplier.contains(searchText, true) ||
            order.currency.contains(searchText, true) || order.status.contains(searchText, true) ||
            order.goodsAmountMinor.toString().contains(searchText)
    }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        SectionHeader("واردات نخ از چین", "ارز، کانتینر، هزینه‌ها و سررسید تأمین‌کننده") { editingOrder = null; dialog = true }
        FormField("جست‌وجوی کانتینر، تأمین‌کننده، ارز یا مبلغ", searchText) { searchText = it }
        if (imports.isEmpty()) EmptyState("سفارشی ثبت نشده است", "اطلاعات خرید خارجی و هزینه‌های حمل را وارد کن")
        else if (visibleImports.isEmpty()) EmptyState("سفارشی پیدا نشد", "عبارت جست‌وجو را تغییر بده یا پاک کن")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
            items(visibleImports, key = { it.id }) { order ->
                val supplier = parties.firstOrNull { it.id == order.supplierId }?.name ?: "تأمین‌کننده"
                val total = runCatching {
                    LandedCostCalculator.totalCostRial(
                        order.goodsAmountMinor, order.fxRateToRial,
                        order.freightRial, order.customsRial, order.otherCostsRial
                    )
                }.getOrDefault(0L)
                val perKg = runCatching { LandedCostCalculator.costPerKgRial(total, order.grossWeightKg) }.getOrDefault(0L)
                GlassCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("کانتینر ${order.containerCode}", color = Color.White, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        AssistChip(
                            onClick = {},
                            label = { Text(if (order.status == "RECEIVED") "رسید شده" else "در انتظار رسید", fontSize = 10.sp) },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = if (order.status == "RECEIVED") Color(0xFF174D4A) else Color(0xFF34485D),
                                labelColor = if (order.status == "RECEIVED") Turquoise else Muted
                            )
                        )
                    }
                    Text("$supplier  •  ${order.currency}", color = Muted, fontSize = 11.sp)
                    Text("وزن: ${formatQuantity(order.grossWeightKg)} کیلوگرم", color = Muted, fontSize = 12.sp)
                    Text("بهای تمام‌شده هر کیلو: ${formatMoney(perKg, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Turquoise)
                    Text("سررسید تسویه: ${java.text.SimpleDateFormat("yyyy/MM/dd", Locale.getDefault()).format(java.util.Date(order.supplierDueAt))}", color = Muted, fontSize = 11.sp)
                    if (order.status != "RECEIVED") {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { editingOrder = order; dialog = true }, modifier = Modifier.weight(1f)) { Text("ویرایش سفارش") }
                            Button(
                            onClick = { receivingOrder = order },
                            enabled = products.isNotEmpty(),
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Turquoise, contentColor = Navy)
                            ) { Text("دریافت محموله و ورود به انبار") }
                        }
                    } else {
                        Text("موجودی وارد انبار شده و سند بهای تمام‌شده صادر شده است.", color = Muted, fontSize = 10.sp)
                    }
                }
            }
        }
    }
    if (dialog) ImportDialog(parties, existing = editingOrder, onDismiss = { dialog = false; editingOrder = null }, onSave = { a,b,c,d,e,f,g,h,i,j ->
        val current = editingOrder
        if (current == null) onAdd(a,b,c,d,e,f,g,h,i,j) { dialog = false }
        else onEdit(current.id, a,b,c,d,e,f,g,h,i,j) { dialog = false; editingOrder = null }
    })
    receivingOrder?.let { order ->
        ImportReceiptDialog(
            order = order, products = products,
            onDismiss = { receivingOrder = null },
            onSave = { lines -> onReceive(order.id, lines) { receivingOrder = null } }
        )
    }
}

private class ImportReceiptDraftRow(initialProductId: Long) {
    var productId by mutableStateOf(initialProductId)
    var quantity by mutableStateOf("")
}

@Composable
private fun ImportReceiptDialog(
    order: ImportOrderEntity,
    products: List<ProductWithStock>,
    onDismiss: () -> Unit,
    onSave: (List<ImportReceiptLineInput>) -> Unit
) {
    val rows = remember(order.id) { mutableStateListOf(ImportReceiptDraftRow(products.firstOrNull()?.product?.id ?: 0L)) }
    val totalKg = rows.sumOf { it.quantity.toDoubleOrNull()?.takeIf { value -> value.isFinite() && value > 0 } ?: 0.0 }
    val valid = products.isNotEmpty() && rows.isNotEmpty() &&
        rows.all { it.productId > 0 && (it.quantity.toDoubleOrNull()?.let { q -> q > 0 && q.isFinite() } == true) } &&
        kotlin.math.abs(totalKg - order.grossWeightKg) <= 0.001
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("رسید انبار کانتینر " + order.containerCode) },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("وزن سفارش: ${formatQuantity(order.grossWeightKg)} کیلوگرم", color = Muted, fontSize = 11.sp)
                rows.forEachIndexed { index, row ->
                    GlassCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("کالای ردیف ${index + 1}", color = Turquoise, modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold)
                            if (rows.size > 1) TextButton(onClick = { rows.remove(row) }) { Text("حذف", color = Color(0xFFFF9D9D)) }
                        }
                        ChoiceField(
                            "کالا",
                            products.firstOrNull { it.product.id == row.productId }?.product?.name ?: "انتخاب کالا",
                            products.map { it.product.name }
                        ) { name -> row.productId = products.firstOrNull { it.product.name == name }?.product?.id ?: 0L }
                        FormField("مقدار دریافتی (کیلوگرم)", row.quantity, KeyboardType.Decimal) { row.quantity = it }
                    }
                }
                TextButton(onClick = { rows.add(ImportReceiptDraftRow(products.firstOrNull()?.product?.id ?: 0L)) }) {
                    Text("+ افزودن کالای دیگر", color = Turquoise)
                }
                Text(
                    "جمع وزن ثبت‌شده: ${formatQuantity(totalKg)} از ${formatQuantity(order.grossWeightKg)} کیلوگرم",
                    color = if (valid) Turquoise else Color(0xFFFFC078),
                    fontSize = 11.sp
                )
                Text("هزینه خرید، حمل، گمرک و سایر هزینه‌ها به نسبت وزن بین کالاها سرشکن می‌شود.", color = Muted, fontSize = 10.sp)
            }
        },
        confirmButton = {
            TextButton(
                enabled = valid,
                onClick = {
                    onSave(rows.map { ImportReceiptLineInput(it.productId, it.quantity.toDouble()) })
                }
            ) { Text("ثبت رسید و ورود به انبار") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D),
        titleContentColor = Color.White,
        textContentColor = Color.White
    )
}

@Composable
private fun AccountingScreen(
    voucherCount: Int,
    invoices: List<InvoiceEntity>,
    treasury: List<ir.billion.holloopro.data.TreasuryEntryEntity>,
    checks: List<CheckEntity>,
    bankStatements: List<BankStatementLineEntity>,
    bankStatementPeriods: List<BankStatementPeriodEntity>,
    accountBalances: List<AccountBalanceRow>,
    trialBalance: List<AccountTrialBalanceRow>,
    ledger: List<LedgerRow>,
    profitLoss: ir.billion.holloopro.data.ProfitLossRow,
    productProfitability: List<ProductProfitRow>,
    invoiceProfitability: List<InvoiceProfitRow>,
    invoiceAging: List<ir.billion.holloopro.data.InvoiceAgingRow>,
    parties: List<PartyEntity>,
    showToman: Boolean,
    onExportReports: () -> Unit,
    onExportReportsPdf: () -> Unit,
    onAddTreasury: (String, String, Long, Long, String, String, () -> Unit) -> Unit,
    onEditTreasury: (Long, String, String, Long, Long, String, String, () -> Unit) -> Unit,
    onAddManualVoucher: (String, List<VoucherLineDraft>, () -> Unit) -> Unit,
    onUpdateOpeningBalances: (Map<String, Pair<Long, Long>>) -> Unit,
    onSaveAccount: (String, String, String, () -> Unit) -> Unit,
    onReverseManualVoucher: (String) -> Unit,
    onAddBankStatementLine: (String, Long, Long, String, String, () -> Unit) -> Unit,
    onEditBankStatementLine: (Long, String, Long, Long, String, String, () -> Unit) -> Unit,
    onMatchBankStatementLine: (Long, Long) -> Unit,
    onUnmatchBankStatementLine: (Long) -> Unit,
    onMatchBankStatementLineToCheck: (Long, Long) -> Unit,
    onAddBankFee: (String, Long, Long, String, String, () -> Unit) -> Unit,
    onAddBankStatementPeriod: (String, Long, Long, Long, Long) -> Unit,
    onImportBankCsv: () -> Unit
) {
    var showDialog by remember { mutableStateOf(false) }
    var editingTreasury by remember { mutableStateOf<ir.billion.holloopro.data.TreasuryEntryEntity?>(null) }
    var showManualDialog by remember { mutableStateOf(false) }
    var showOpeningDialog by remember { mutableStateOf(false) }
    var reversalTarget by remember { mutableStateOf<String?>(null) }
    var accountEditor by remember { mutableStateOf<AccountTrialBalanceRow?>(null) }
    var showNewAccount by remember { mutableStateOf(false) }
    var ledgerAccountFilter by remember { mutableStateOf("همه حساب‌ها") }
    var ledgerFromFilter by remember { mutableStateOf("") }
    var ledgerToFilter by remember { mutableStateOf("") }
    val sales = invoices.filter { it.kind == "SALE" && it.status == "POSTED" }.sumOf { it.totalRial }
    val purchases = invoices.filter { it.kind == "PURCHASE" && it.status == "POSTED" }.sumOf { it.totalRial }
    val openingAccounts = trialBalance.ifEmpty {
        listOf(
            "1101" to "صندوق", "1102" to "بانک", "1103" to "حساب‌های دریافتنی",
            "1301" to "موجودی کالا", "2101" to "حساب‌های پرداختنی",
            "2102" to "هزینه‌های واردات پرداختنی", "4101" to "فروش کالا", "5101" to "بهای تمام‌شده"
        ).mapIndexed { index, account ->
            AccountTrialBalanceRow(index.toLong() + 1L, account.first, account.second, "ASSET", 0, 0, 0, 0, 0, 0)
        }
    }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("دفتر و حسابداری دوبل", modifier = Modifier.weight(1f), color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedButton(onClick = { showOpeningDialog = true }) { Text("مانده افتتاحیه") }
                    OutlinedButton(onClick = { showManualDialog = true }) { Text("سند دستی") }
                    Button(onClick = { editingTreasury = null; showDialog = true }, colors = ButtonDefaults.buttonColors(containerColor = Turquoise, contentColor = Navy)) {
                        Text("دریافت/پرداخت")
                    }
                }
            }
        }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onExportReports, modifier = Modifier.weight(1f)) { Text("خروجی CSV") }
            OutlinedButton(onClick = onExportReportsPdf, modifier = Modifier.weight(1f)) { Text("خروجی PDF / چاپ") }
        } }
        item {
            GlassCard {
                Text("سوابق دریافت و پرداخت", color = Turquoise, fontWeight = FontWeight.Bold)
                if (treasury.isEmpty()) Text("هنوز سندی ثبت نشده است.", color = Muted, fontSize = 11.sp)
                treasury.take(80).forEach { entry ->
                    val partyName = parties.firstOrNull { it.id == entry.partyId }?.name ?: "طرف حساب حذف‌شده"
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text("${if (entry.kind == "RECEIPT") "دریافت" else "پرداخت"} • $partyName", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Text("${if (entry.method == "CASH") "صندوق" else "بانک"} • ${entry.referenceNumber.ifBlank { "بدون شماره پیگیری" }}", color = Muted, fontSize = 10.sp)
                            Text("${formatMoney(entry.amountRial, showToman)} ${if (showToman) "تومان" else "ریال"} • ${entry.note}", color = Turquoise, fontSize = 11.sp)
                        }
                        TextButton(onClick = { editingTreasury = entry; showDialog = true }) { Text("ویرایش") }
                    }
                    Divider(color = CardBorder)
                }
            }
        }
        item { StatCard("اسناد صادرشده", voucherCount.toString(), "≋", Modifier.fillMaxWidth()) }
        item {
            val now = System.currentTimeMillis()
            val bucketLabels = listOf("۰ تا ۳۰ روز", "۳۱ تا ۶۰ روز", "۶۱ تا ۹۰ روز", "بیش از ۹۰ روز")
            val buckets = bucketLabels.mapIndexed { index, label ->
                label to invoiceAging.filter { row ->
                    ir.billion.holloopro.data.InvoiceAging.bucket(
                        ir.billion.holloopro.data.InvoiceAging.ageDays(now, row.dateEpoch)
                    ) == index
                }
            }
            GlassCard {
                Text("گزارش سنی مطالبات و بدهی فاکتورها", color = Turquoise, fontWeight = FontWeight.Bold)
                Text("مانده باز پس از کسر تسویه‌ها و برگشت‌ها؛ فروش = مطالبات، خرید = بدهی.", color = Muted, fontSize = 10.sp)
                buckets.forEach { (label, rows) ->
                    val receivable = ir.billion.holloopro.data.InvoiceAging.sumOutstanding(rows, "SALE")
                    val payable = ir.billion.holloopro.data.InvoiceAging.sumOutstanding(rows, "PURCHASE")
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(label, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        if (receivable == null || payable == null) {
                            Text("خطای محاسباتی: جمع مانده این بازه از محدوده عددی مجاز خارج شده است.", color = Color(0xFFFF9D9D), fontSize = 10.sp)
                        } else {
                            Text("مطالبات: ${formatMoney(receivable, showToman)} • بدهی: ${formatMoney(payable, showToman)}", color = Muted, fontSize = 10.sp)
                        }
                    }
                    Divider(color = CardBorder)
                }
                if (invoiceAging.isEmpty()) Text("فاکتور تسویه‌نشده‌ای وجود ندارد.", color = Muted, fontSize = 11.sp)
                invoiceAging.take(30).forEach { row ->
                    val ageDays = ir.billion.holloopro.data.InvoiceAging.ageDays(now, row.dateEpoch)
                    Text("${row.invoiceNumber} • ${row.partyName}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    Text("${if (row.kind == "SALE") "مطالبه" else "بدهی"} • ${ageDays} روز • مانده: ${formatMoney(row.outstandingRial, showToman)}", color = if (row.kind == "SALE") Turquoise else Color(0xFFFFC47A), fontSize = 10.sp)
                }
            }
        }
        item { SummaryCard("درآمد فروش (بدون مالیات)", profitLoss.salesRial, showToman) }
        item { SummaryCard("بهای تمام‌شده کالای فروش‌رفته", profitLoss.costOfGoodsSoldRial, showToman) }
        item { SummaryCard("سود ناخالص فاکتورها", profitLoss.salesRial - profitLoss.costOfGoodsSoldRial, showToman) }
        item {
            GlassCard {
                Text("سودآوری هر کالا", color = Turquoise, fontWeight = FontWeight.Bold)
                val rows = productProfitability.filter { it.quantitySoldKg > 0.000001 }
                if (rows.isEmpty()) Text("هنوز فروش ثبت‌شده‌ای برای محاسبه سود کالا وجود ندارد.", color = Muted, fontSize = 11.sp)
                rows.take(12).forEach { row ->
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(row.productName, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Text("فروش خالص: ${formatMoney(row.salesRial, showToman)} • بهای تمام‌شده: ${formatMoney(row.costRial, showToman)}", color = Muted, fontSize = 10.sp)
                        Text("مقدار خالص فروخته‌شده: ${formatQuantity(row.quantitySoldKg)} کیلو • سود: ${formatMoney(row.profitRial, showToman)}", color = if (row.profitRial >= 0) Turquoise else Color(0xFFFF9D9D), fontSize = 11.sp)
                    }
                    Divider(color = CardBorder)
                }
            }
        }
        item {
            GlassCard {
                Text("سودآوری هر فاکتور فروش", color = Turquoise, fontWeight = FontWeight.Bold)
                if (invoiceProfitability.isEmpty()) Text("فاکتور فروش ثبت‌شده‌ای برای گزارش وجود ندارد.", color = Muted, fontSize = 11.sp)
                invoiceProfitability.take(12).forEach { row ->
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("${row.invoiceNumber} • ${row.partyName}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        Text("فروش خالص: ${formatMoney(row.salesRial, showToman)} • بهای تمام‌شده: ${formatMoney(row.costRial, showToman)}", color = Muted, fontSize = 10.sp)
                        Text("سود ناخالص: ${formatMoney(row.profitRial, showToman)}", color = if (row.profitRial >= 0) Turquoise else Color(0xFFFF9D9D), fontSize = 11.sp)
                    }
                    Divider(color = CardBorder)
                }
            }
        }
        item {
            GlassCard {
                Text("سودآوری به تفکیک طرف حساب", color = Turquoise, fontWeight = FontWeight.Bold)
                val byParty = invoiceProfitability.groupBy { it.partyId }
                    .map { (_, rows) -> rows.first().partyName to rows.sumOf { it.profitRial } }
                    .sortedByDescending { it.second }
                if (byParty.isEmpty()) Text("اطلاعاتی برای محاسبه سود طرف حساب وجود ندارد.", color = Muted, fontSize = 11.sp)
                byParty.take(12).forEach { (partyName, profit) ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(partyName, color = Color.White, fontSize = 11.sp)
                        Text(formatMoney(profit, showToman), color = if (profit >= 0) Turquoise else Color(0xFFFF9D9D), fontSize = 11.sp)
                    }
                }
            }
        }

        item {
            val revenue = trialBalance.filter { it.accountType == "REVENUE" }.sumOf { it.endingCreditRial - it.endingDebitRial }
            val expense = trialBalance.filter { it.accountType == "EXPENSE" }.sumOf { it.endingDebitRial - it.endingCreditRial }
            val netProfit = revenue - expense
            val assets = trialBalance.filter { it.accountType == "ASSET" }.sumOf { it.endingDebitRial - it.endingCreditRial }
            val liabilities = trialBalance.filter { it.accountType == "LIABILITY" }.sumOf { it.endingCreditRial - it.endingDebitRial }
            val equity = trialBalance.filter { it.accountType == "EQUITY" }.sumOf { it.endingCreditRial - it.endingDebitRial } + netProfit
            GlassCard {
                Text("صورت سود و زیان تجمیعی", color = Turquoise, fontWeight = FontWeight.Bold)
                Text("درآمدها: ${formatMoney(revenue, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Color.White)
                Text("هزینه‌ها: ${formatMoney(expense, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Color.White)
                Text("سود / زیان خالص: ${formatMoney(netProfit, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Turquoise, fontWeight = FontWeight.Bold)
                Text("مبنای محاسبه: مانده حساب‌های درآمد و هزینه از اسناد ثبت‌شده؛ گزارش تجمیعی تا این لحظه.", color = Muted, fontSize = 10.sp)
            }
            GlassCard {
                Text("ترازنامه", color = Turquoise, fontWeight = FontWeight.Bold)
                Text("دارایی‌ها: ${formatMoney(assets, showToman)}", color = Color.White)
                Text("بدهی‌ها: ${formatMoney(liabilities, showToman)}", color = Color.White)
                Text("حقوق مالکانه با احتساب سود/زیان جاری: ${formatMoney(equity, showToman)}", color = Color.White)
                val difference = assets - liabilities - equity
                Text("اختلاف تراز: ${formatMoney(kotlin.math.abs(difference), showToman)} ${if (difference == 0L) "• تراز است" else "• نیازمند بررسی"}", color = if (difference == 0L) Turquoise else Color(0xFFFF9D9D), fontWeight = FontWeight.Bold)
            }
        }
        item { SummaryCard("جمع فاکتورهای فروش ثبت‌شده", sales, showToman) }
        item { SummaryCard("جمع فاکتورهای خرید ثبت‌شده", purchases, showToman) }
        item {
            GlassCard {
                Text("گردش صندوق و بانک", color = Turquoise, fontWeight = FontWeight.Bold)
                if (treasury.isEmpty()) Text("هنوز دریافت یا پرداختی ثبت نشده است", color = Muted, fontSize = 11.sp)
                treasury.take(8).forEach { entry ->
                    val party = parties.firstOrNull { it.id == entry.partyId }?.name ?: "طرف حساب"
                    Text(
                        "${if (entry.kind == "RECEIPT") "دریافت از" else "پرداخت به"} $party • ${if (entry.method == "CASH") "صندوق" else "بانک"}",
                        color = Color.White,
                        fontSize = 12.sp
                    )
                    Text(
                        "${formatMoney(entry.amountRial, showToman)} ${if (showToman) "تومان" else "ریال"}",
                        color = Turquoise,
                        fontSize = 12.sp
                    )
                }
            }
        }
        item {
            BankReconciliationSection(bankStatements, bankStatementPeriods, treasury, checks, showToman, onAddBankStatementLine, onEditBankStatementLine, onMatchBankStatementLine, onUnmatchBankStatementLine, onMatchBankStatementLineToCheck, onAddBankFee, onAddBankStatementPeriod, onImportBankCsv)
        }
        item {
            GlassCard {
                Text("مانده خالص حساب‌ها", color = Turquoise, fontWeight = FontWeight.Bold)
                if (accountBalances.isEmpty()) Text("مانده بدهکار یا بستانکار هر حساب پس از تهاتر گردش‌ها نمایش داده می‌شود.", color = Muted, fontSize = 11.sp)
                accountBalances.forEach { account ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("${account.accountCode} • ${account.accountTitle}", color = Color.White, fontSize = 11.sp)
                            Text(account.accountType, color = Muted, fontSize = 9.sp)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("بدهکار ${formatMoney(account.debitRial, showToman)}", color = Turquoise, fontSize = 10.sp)
                            Text("بستانکار ${formatMoney(account.creditRial, showToman)}", color = Muted, fontSize = 10.sp)
                        }
                    }
                }
            }
        }
        item {
            GlassCard {
                Text("تراز آزمایشی • ۸ ستونی", color = Turquoise, fontWeight = FontWeight.Bold)
                Text("افتتاحیه، گردش دوره و مانده پایان دوره هر حساب", color = Muted, fontSize = 10.sp)
                val debitTurnover = trialBalance.sumOf { it.debitTurnoverRial }
                val creditTurnover = trialBalance.sumOf { it.creditTurnoverRial }
                val endingDebit = trialBalance.sumOf { it.endingDebitRial }
                val endingCredit = trialBalance.sumOf { it.endingCreditRial }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("گردش بدهکار", color = Muted, fontSize = 9.sp)
                    Text("گردش بستانکار", color = Muted, fontSize = 9.sp)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(formatMoney(debitTurnover, showToman), color = Turquoise, fontSize = 11.sp)
                    Text(formatMoney(creditTurnover, showToman), color = Turquoise, fontSize = 11.sp)
                }
                Divider(color = CardBorder)
                trialBalance.forEach { row ->
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("${row.accountCode} • ${row.accountTitle}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("افتتاحیه بدهکار: ${formatMoney(row.openingDebitRial, showToman)}", color = Muted, fontSize = 9.sp)
                            Text("افتتاحیه بستانکار: ${formatMoney(row.openingCreditRial, showToman)}", color = Muted, fontSize = 9.sp)
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("گردش بدهکار: ${formatMoney(row.debitTurnoverRial, showToman)}", color = Muted, fontSize = 9.sp)
                            Text("گردش بستانکار: ${formatMoney(row.creditTurnoverRial, showToman)}", color = Muted, fontSize = 9.sp)
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("مانده پایان بدهکار: ${formatMoney(row.endingDebitRial, showToman)}", color = Turquoise, fontSize = 9.sp)
                            Text("مانده پایان بستانکار: ${formatMoney(row.endingCreditRial, showToman)}", color = Turquoise, fontSize = 9.sp)
                        }
                    }
                    Divider(color = CardBorder)
                }
                val isBalanced = debitTurnover == creditTurnover && endingDebit == endingCredit
                Text(
                    if (isBalanced) "تراز است؛ جمع گردش و مانده‌ها برابر است." else "هشدار: اختلاف در گردش یا مانده حساب‌ها وجود دارد.",
                    color = if (isBalanced) Turquoise else Color(0xFFFF9D9D),
                    fontSize = 10.sp
                )
            }
        }
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("کدینگ و گروه‌بندی حساب‌ها", color = Turquoise, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    TextButton(onClick = { showNewAccount = true }) { Text("افزودن حساب", color = Turquoise) }
                }
                trialBalance.groupBy { it.accountType }.forEach { (type, rows) ->
                    Text(accountTypeLabel(type), color = Turquoise, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    rows.forEach { account ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text("${account.accountCode} • ${account.accountTitle}", color = Color.White, fontSize = 11.sp, modifier = Modifier.weight(1f))
                            TextButton(onClick = { accountEditor = account }) { Text("ویرایش", color = Muted) }
                        }
                    }
                }
                Text("گردش دفتر کل (آخرین اسناد)", color = Turquoise, fontWeight = FontWeight.Bold)
                if (ledger.isEmpty()) Text("هنوز سندی برای نمایش وجود ندارد", color = Muted, fontSize = 11.sp)
                ChoiceField("حساب دفتر", ledgerAccountFilter, listOf("همه حساب‌ها") + trialBalance.map { it.accountCode + " • " + it.accountTitle }) { ledgerAccountFilter = it }
                FormField("از تاریخ (YYYY-MM-DD)", ledgerFromFilter) { ledgerFromFilter = it }
                FormField("تا تاریخ (YYYY-MM-DD)", ledgerToFilter) { ledgerToFilter = it }
                val selectedAccountCode = ledgerAccountFilter.substringBefore(" • ").takeIf { ledgerAccountFilter != "همه حساب‌ها" }
                val fromEpoch = runCatching { java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(ledgerFromFilter)?.time ?: Long.MIN_VALUE }.getOrDefault(Long.MIN_VALUE)
                val toEpoch = runCatching { java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(ledgerToFilter)?.time?.plus(86_399_999L) ?: Long.MAX_VALUE }.getOrDefault(Long.MAX_VALUE)
                val selectedOpening = trialBalance.filter { selectedAccountCode == null || it.accountCode == selectedAccountCode }
                    .sumOf { it.openingDebitRial - it.openingCreditRial }
                val priorMovement = ledger.filter { (selectedAccountCode == null || it.accountCode == selectedAccountCode) && it.dateEpoch < fromEpoch }
                    .sumOf { it.debitRial - it.creditRial }
                val periodOpening = selectedOpening + priorMovement
                val filteredLedger = ledger.filter { (selectedAccountCode == null || it.accountCode == selectedAccountCode) && it.dateEpoch >= fromEpoch && it.dateEpoch <= toEpoch }.take(100)
                Text("مانده ابتدای دوره: ${formatMoney(periodOpening, showToman)} ${if (showToman) "تومان" else "ریال"} • ${filteredLedger.size} ردیف", color = Turquoise, fontSize = 10.sp)
                filteredLedger.forEach { row ->
                    Divider(color = CardBorder)
                    Text("${row.accountCode} • ${row.accountTitle}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text("${row.voucherNumber} • ${row.voucherDescription}", color = Muted, fontSize = 10.sp)
                    Text("بدهکار ${formatMoney(row.debitRial, showToman)}  |  بستانکار ${formatMoney(row.creditRial, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Turquoise, fontSize = 10.sp)
                    if (row.reference.startsWith("MANUAL:")) TextButton(onClick = { reversalTarget = row.voucherNumber }) { Text("ثبت سند معکوس", color = Color(0xFFFFC47A)) }
                }
                Text("اسناد فاکتور و دریافت/پرداخت به‌صورت دوبل ثبت می‌شوند.", color = Muted, fontSize = 11.sp)
            }
        }
    }
    if (showDialog) {
        TreasuryDialog(
            parties = parties, existing = editingTreasury,
            onDismiss = { showDialog = false; editingTreasury = null },
            onSave = { a, b, c, d, e, f ->
                val current = editingTreasury
                if (current == null) onAddTreasury(a, b, c, d, e, f) { showDialog = false }
                else onEditTreasury(current.id, a, b, c, d, e, f) { showDialog = false; editingTreasury = null }
            }
        )
    }
    if (showManualDialog) {
        ManualVoucherDialog(
            onDismiss = { showManualDialog = false },
            onSave = { description, lines ->
                onAddManualVoucher(description, lines) { showManualDialog = false }
            }
        )
    }
    if (showOpeningDialog) {
        OpeningBalancesDialog(
            accounts = openingAccounts,
            onDismiss = { showOpeningDialog = false },
            onSave = { values -> onUpdateOpeningBalances(values); showOpeningDialog = false }
        )
    }
    if (showNewAccount) AccountEditorDialog(null, onDismiss = { showNewAccount = false }, onSave = { code, title, type -> onSaveAccount(code, title, type) { showNewAccount = false } })
    accountEditor?.let { account -> AccountEditorDialog(account, onDismiss = { accountEditor = null }, onSave = { code, title, type -> onSaveAccount(code, title, type) { accountEditor = null } }) }
    reversalTarget?.let { number ->
        AlertDialog(
            onDismissRequest = { reversalTarget = null },
            title = { Text("تأیید برگشت سند") },
            text = { Text("برای سند $number یک سند معکوس ایجاد می‌شود. سند اصلی حذف یا ویرایش نمی‌شود. ادامه می‌دهید؟") },
            confirmButton = {
                TextButton(onClick = { onReverseManualVoucher(number); reversalTarget = null }) {
                    Text("تأیید برگشت", color = Color(0xFFFFC47A))
                }
            },
            dismissButton = { TextButton(onClick = { reversalTarget = null }) { Text("انصراف") } },
            containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
        )
    }
}

@Composable
private fun AccountEditorDialog(
    account: AccountTrialBalanceRow?,
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit
) {
    var code by remember(account?.accountId) { mutableStateOf(account?.accountCode ?: "") }
    var title by remember(account?.accountId) { mutableStateOf(account?.accountTitle ?: "") }
    var type by remember(account?.accountId) { mutableStateOf(account?.accountType ?: "ASSET") }
    var expanded by remember { mutableStateOf(false) }
    val types = listOf("ASSET" to "دارایی", "LIABILITY" to "بدهی", "EQUITY" to "حقوق مالکانه", "REVENUE" to "درآمد", "EXPENSE" to "هزینه")
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (account == null) "افزودن حساب جدید" else "ویرایش حساب") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(code, { if (account == null) code = it.filter(Char::isDigit) }, label = { Text("کد حساب") }, enabled = account == null, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(title, { title = it }, label = { Text("عنوان حساب") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Box {
                    OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) { Text(types.firstOrNull { it.first == type }?.second ?: type) }
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        types.forEach { item -> DropdownMenuItem(text = { Text(item.second) }, onClick = { type = item.first; expanded = false }) }
                    }
                }
                Text("کد حساب پس از ثبت قابل تغییر نیست تا اسناد قبلی به حساب اشتباه متصل نشوند.", color = Muted, fontSize = 10.sp)
            }
        },
        confirmButton = { TextButton(enabled = code.length >= 3 && title.isNotBlank(), onClick = { onSave(code, title, type) }) { Text("ذخیره") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White
    )
}

private fun accountTypeLabel(type: String): String = when (type) {
    "ASSET" -> "دارایی‌ها"
    "LIABILITY" -> "بدهی‌ها"
    "EQUITY" -> "حقوق مالکانه"
    "REVENUE" -> "درآمدها"
    "EXPENSE" -> "هزینه‌ها"
    else -> type
}

@Composable
private fun OpeningBalancesDialog(
    accounts: List<AccountTrialBalanceRow>,
    onDismiss: () -> Unit,
    onSave: (Map<String, Pair<Long, Long>>) -> Unit
) {
    var values by remember {
        mutableStateOf(accounts.associate { it.accountCode to (it.openingDebitRial to it.openingCreditRial) })
    }
    val debitTotal = values.values.fold(BigInteger.ZERO) { total, value -> total + BigInteger.valueOf(value.first) }
    val creditTotal = values.values.fold(BigInteger.ZERO) { total, value -> total + BigInteger.valueOf(value.second) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("ثبت مانده افتتاحیه حساب‌ها") },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("مانده‌های ابتدای دوره را وارد کنید. جمع دو ستون باید برابر باشد.", color = Muted, fontSize = 11.sp)
                accounts.forEach { account ->
                    val amount = values[account.accountCode] ?: (0L to 0L)
                    GlassCard {
                        Text("${account.accountCode} • ${account.accountTitle}", color = Turquoise, fontWeight = FontWeight.Bold)
                        OutlinedTextField(
                            amount.first.takeIf { it > 0 }?.toString() ?: "",
                            { raw -> values = values.toMutableMap().also { it[account.accountCode] = (raw.filter(Char::isDigit).toLongOrNull() ?: 0L) to 0L } },
                            label = { Text("افتتاحیه بدهکار (ریال)") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                        OutlinedTextField(
                            amount.second.takeIf { it > 0 }?.toString() ?: "",
                            { raw -> values = values.toMutableMap().also { it[account.accountCode] = 0L to (raw.filter(Char::isDigit).toLongOrNull() ?: 0L) } },
                            label = { Text("افتتاحیه بستانکار (ریال)") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                    }
                }
                Text("جمع بدهکار: $debitTotal ریال", color = Turquoise, fontSize = 11.sp)
                Text("جمع بستانکار: $creditTotal ریال", color = if (debitTotal == creditTotal && debitTotal.signum() > 0) Turquoise else Color(0xFFFF9D9D), fontSize = 11.sp)
            }
        },
        confirmButton = { TextButton(onClick = { onSave(values) }) { Text("ذخیره مانده‌ها") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D),
        titleContentColor = Color.White,
        textContentColor = Color.White
    )
}

@Composable
private fun ManualVoucherDialog(
    onDismiss: () -> Unit,
    onSave: (String, List<VoucherLineDraft>) -> Unit
) {
    var description by remember { mutableStateOf("") }
    var rows by remember { mutableStateOf(listOf(VoucherLineDraft("1101"), VoucherLineDraft("4101", creditRial = 0))) }
    val accounts = listOf(
        "1101" to "صندوق", "1102" to "بانک", "1103" to "دریافتنی",
        "1301" to "موجودی کالا", "2101" to "پرداختنی", "2102" to "هزینه واردات پرداختنی",
        "4101" to "فروش", "5101" to "بهای تمام‌شده"
    )
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("ثبت سند حسابداری چندردیفی") },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(description, { description = it }, label = { Text("شرح سند") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                rows.forEachIndexed { index, row ->
                    GlassCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("ردیف ${index + 1}", color = Turquoise, modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold)
                            if (rows.size > 2) TextButton(onClick = { rows = rows.filterIndexed { i, _ -> i != index } }) { Text("حذف") }
                        }
                        var expanded by remember(index, rows.size) { mutableStateOf(false) }
                        Box {
                            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                                Text(accounts.firstOrNull { it.first == row.accountCode }?.let { "${it.first} • ${it.second}" } ?: "انتخاب حساب")
                            }
                            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                                accounts.forEach { (code, title) ->
                                    DropdownMenuItem(text = { Text("$code • $title") }, onClick = {
                                        rows = rows.toMutableList().also { it[index] = row.copy(accountCode = code) }
                                        expanded = false
                                    })
                                }
                            }
                        }
                        OutlinedTextField(
                            row.debitRial.takeIf { it > 0 }?.toString() ?: "",
                            { value -> rows = rows.toMutableList().also { it[index] = row.copy(debitRial = value.filter(Char::isDigit).toLongOrNull() ?: 0L, creditRial = 0L) } },
                            label = { Text("بدهکار (ریال)") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                        OutlinedTextField(
                            row.creditRial.takeIf { it > 0 }?.toString() ?: "",
                            { value -> rows = rows.toMutableList().also { it[index] = row.copy(creditRial = value.filter(Char::isDigit).toLongOrNull() ?: 0L, debitRial = 0L) } },
                            label = { Text("بستانکار (ریال)") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                    }
                }
                OutlinedButton(onClick = { rows = rows + VoucherLineDraft("1101") }, modifier = Modifier.fillMaxWidth()) {
                    Text("＋ افزودن ردیف")
                }
                val debit = rows.sumOf { it.debitRial }
                val credit = rows.sumOf { it.creditRial }
                Text("جمع بدهکار: ${formatMoney(debit, false)} ریال", color = Turquoise, fontSize = 11.sp)
                Text("جمع بستانکار: ${formatMoney(credit, false)} ریال", color = if (debit == credit && debit > 0) Turquoise else Color(0xFFFF9D9D), fontSize = 11.sp)
                Text("برای ثبت، جمع بدهکار و بستانکار باید برابر و هر ردیف فقط یک سمت داشته باشد.", color = Muted, fontSize = 10.sp)
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(description, rows) }) { Text("ثبت سند") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D),
        titleContentColor = Color.White,
        textContentColor = Color.White
    )
}

@Composable
private fun SummaryCard(label: String, rial: Long, showToman: Boolean) {
    GlassCard {
        Text(label, color = Muted, fontSize = 12.sp)
        Text("${formatMoney(rial, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Turquoise, fontSize = 20.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SectionHeader(title: String, subtitle: String, onAdd: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text(subtitle, color = Muted, fontSize = 10.sp)
        }
        Button(onClick = onAdd, colors = ButtonDefaults.buttonColors(containerColor = Turquoise, contentColor = Navy)) {
            Text("+ ثبت")
        }
    }
}

@Composable
private fun GlassCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(listOf(Color(0xCC16344E), Color(0xCC0D2239))))
            .padding(15.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        content = content
    )
}

@Composable
private fun EmptyState(title: String, subtitle: String) {
    Box(Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
        GlassCard {
            Text(title, color = Color.White, fontWeight = FontWeight.Bold)
            Text(subtitle, color = Muted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun ProductDialog(existing: ProductEntity? = null, onDismiss: () -> Unit, onSave: (Long?, String, String, String, String, String, Int, Boolean, String) -> Unit) {
    var sku by remember(existing?.id) { mutableStateOf(existing?.sku ?: "") }
    var name by remember(existing?.id) { mutableStateOf(existing?.name ?: "") }
    var group by remember(existing?.id) { mutableStateOf(existing?.groupName ?: "نخ پلی‌استر") }
    var yarnType by remember(existing?.id) { mutableStateOf(existing?.yarnType ?: "FDY") }
    var color by remember(existing?.id) { mutableStateOf(existing?.color ?: "") }
    var denier by remember(existing?.id) { mutableStateOf((existing?.denier ?: 60).toString()) }
    var twisted by remember(existing?.id) { mutableStateOf(existing?.twisted ?: false) }
    var notes by remember(existing?.id) { mutableStateOf(existing?.notes ?: "") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text(if (existing == null) "تعریف کالای نخ" else "ویرایش کالای نخ") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            FormField("کد یکتا", sku) { sku = it }; FormField("نام کالا", name) { name = it }; FormField("گروه کالا", group) { group = it }
            ChoiceField("نوع نخ", yarnType, listOf("FDY", "DTY", "POY", "MX")) { yarnType = it }
            FormField("رنگ", color) { color = it }; FormField("دنیر", denier, KeyboardType.Number) { denier = it }
            Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(checked = twisted, onCheckedChange = { twisted = it }); Text("تاب‌دار", color = Color.White) }
            FormField("توضیحات", notes) { notes = it }
        } },
        confirmButton = { TextButton(onClick = { onSave(existing?.id, sku, name, group, yarnType, color, denier.toIntOrNull() ?: 0, twisted, notes) }) { Text("ذخیره") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }, containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White)
}

@Composable
private fun PartyDialog(existing: PartyEntity? = null, onDismiss: () -> Unit, onSave: (Long?, String, String, String, String, Long) -> Unit) {
    var name by remember(existing?.id) { mutableStateOf(existing?.name ?: "") }
    var kind by remember(existing?.id) { mutableStateOf(existing?.kind ?: "CUSTOMER") }
    var phone by remember(existing?.id) { mutableStateOf(existing?.phone ?: "") }
    var address by remember(existing?.id) { mutableStateOf(existing?.address ?: "") }
    var opening by remember(existing?.id) { mutableStateOf((existing?.openingBalanceRial ?: 0L).toString()) }
    AlertDialog(onDismissRequest = onDismiss, title = { Text(if (existing == null) "ثبت طرف حساب" else "ویرایش طرف حساب") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            FormField("نام شخص یا شرکت", name) { name = it }
            ChoiceField("نوع", partyKind(kind), listOf("مشتری", "تأمین‌کننده", "هر دو")) { kind = when (it) { "مشتری" -> "CUSTOMER"; "تأمین‌کننده" -> "SUPPLIER"; else -> "BOTH" } }
            FormField("تلفن", phone, KeyboardType.Phone) { phone = it }; FormField("نشانی", address) { address = it }
            FormField("مانده افتتاحیه (ریال)", opening, KeyboardType.Number) { opening = it }
        } },
        confirmButton = { TextButton(onClick = { onSave(existing?.id, name, kind, phone, address, opening.toLongOrNull() ?: 0L) }) { Text("ذخیره") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }, containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White)
}

private class InvoiceDraftRow(initialProductId: Long, initialQuantity: String = "1", initialPrice: String = "") {
    var productId by mutableStateOf(initialProductId)
    var quantity by mutableStateOf(initialQuantity)
    var price by mutableStateOf(initialPrice)
}

@Composable
private fun InvoiceDialog(warehouses: List<WarehouseEntity>, parties: List<PartyEntity>, products: List<ProductWithStock>, existing: InvoiceEntity? = null, existingLines: List<ReturnableInvoiceLineRow> = emptyList(), onDismiss: () -> Unit, onSave: (String, Long, List<InvoiceLineInput>, Long, Long, Long, Long) -> Unit) {
    var kind by remember(existing?.id) { mutableStateOf(existing?.kind ?: "SALE") }
    val eligibleParties = parties.filter { if (kind == "SALE") it.kind != "SUPPLIER" else it.kind != "CUSTOMER" }
    var partyId by remember(existing?.id) { mutableStateOf(existing?.partyId ?: eligibleParties.firstOrNull()?.id ?: 0L) }
    var warehouseId by remember(existing?.id) { mutableStateOf(existing?.warehouseId ?: warehouses.firstOrNull()?.id ?: 1L) }
    val rows = remember(existing?.id) {
        mutableStateListOf<InvoiceDraftRow>().apply {
            if (existing != null && existingLines.isNotEmpty()) existingLines.forEach { add(InvoiceDraftRow(it.productId, it.originalQuantityKg.toString(), BigDecimal.valueOf(it.unitPriceRial).divide(BigDecimal.TEN).stripTrailingZeros().toPlainString())) }
            else add(InvoiceDraftRow(products.firstOrNull()?.product?.id ?: 0L))
        }
    }
    var discount by remember(existing?.id) { mutableStateOf(existing?.let { BigDecimal.valueOf(it.discountRial).divide(BigDecimal.TEN).stripTrailingZeros().toPlainString() } ?: "0") }
    var tax by remember(existing?.id) { mutableStateOf(existing?.let { BigDecimal.valueOf(it.taxRial).divide(BigDecimal.TEN).stripTrailingZeros().toPlainString() } ?: "0") }
    var extraCosts by remember(existing?.id) { mutableStateOf(existing?.let { BigDecimal.valueOf(it.extraCostsRial).divide(BigDecimal.TEN).stripTrailingZeros().toPlainString() } ?: "0") }
    val canSubmit = partyId > 0L && rows.isNotEmpty() && rows.all { row ->
        val quantity = row.quantity.toDoubleOrNull()
        val price = row.price.toBigDecimalOrNull()
        row.productId > 0L && quantity != null && quantity.isFinite() && quantity > 0.0 && price != null && price.signum() > 0
    } && (discount.toBigDecimalOrNull()?.signum() ?: -1) >= 0 && (tax.toBigDecimalOrNull()?.signum() ?: -1) >= 0 && (extraCosts.toBigDecimalOrNull()?.signum() ?: -1) >= 0
    AlertDialog(onDismissRequest = onDismiss, title = { Text(if (existing == null) "صدور فاکتور چندردیفی" else "ویرایش فاکتور ${existing.number}") },
        text = {
            Column(modifier = Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = kind == "SALE", enabled = existing == null, onClick = { kind = "SALE"; partyId = parties.firstOrNull { it.kind != "SUPPLIER" }?.id ?: 0L }, label = { Text("فروش") })
                    FilterChip(selected = kind == "PURCHASE", enabled = existing == null, onClick = { kind = "PURCHASE"; partyId = parties.firstOrNull { it.kind != "CUSTOMER" }?.id ?: 0L }, label = { Text("خرید") })
                }
                ChoiceField("طرف حساب", parties.firstOrNull { it.id == partyId }?.name ?: "انتخاب طرف حساب", eligibleParties.map { it.name }) { selected -> partyId = eligibleParties.firstOrNull { it.name == selected }?.id ?: 0L }
                ChoiceField("انبار", warehouses.firstOrNull { it.id == warehouseId }?.name ?: "انبار اصلی", warehouses.map { it.name }) { selected -> warehouseId = warehouses.firstOrNull { it.name == selected }?.id ?: 1L }
                rows.forEachIndexed { index, row ->
                    GlassCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("ردیف ${'$'}{index + 1}", color = Turquoise, modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold)
                            if (rows.size > 1) TextButton(onClick = { rows.remove(row) }) { Text("حذف ردیف", color = Color(0xFFFF9D9D)) }
                        }
                        ChoiceField("کالا", products.firstOrNull { it.product.id == row.productId }?.product?.name ?: "انتخاب کالا", products.map { it.product.name }) { selected -> row.productId = products.firstOrNull { it.product.name == selected }?.product?.id ?: 0L }
                        FormField("مقدار (کیلوگرم)", row.quantity, KeyboardType.Decimal) { row.quantity = it }
                        FormField("قیمت هر کیلو (تومان)", row.price, KeyboardType.Number) { row.price = it }
                    }
                }
                TextButton(onClick = { rows.add(InvoiceDraftRow(products.firstOrNull()?.product?.id ?: 0L)) }, enabled = products.isNotEmpty()) { Text("+ افزودن ردیف کالا", color = Turquoise) }
                FormField("تخفیف کل فاکتور (تومان)", discount, KeyboardType.Number) { discount = it }
                FormField("مالیات کل فاکتور (تومان)", tax, KeyboardType.Number) { tax = it }
                if (kind == "PURCHASE") FormField("هزینه‌های جانبی خرید (تومان)", extraCosts, KeyboardType.Number) { extraCosts = it }
                Text("هزینه جانبی خرید به بهای تمام‌شده موجودی اضافه و بین ردیف‌ها متناسب با مبلغ کالا سرشکن می‌شود.", color = Muted, fontSize = 10.sp)
            }
        },
        confirmButton = {
            TextButton(enabled = canSubmit, onClick = {
                val lines = rows.mapNotNull { row ->
                    val quantity = row.quantity.toDoubleOrNull() ?: 0.0
                    val priceRial = (row.price.toBigDecimalOrNull() ?: BigDecimal.ZERO).multiply(BigDecimal.TEN).toLong()
                    if (row.productId > 0 && quantity > 0 && priceRial > 0) InvoiceLineInput(row.productId, quantity, priceRial) else null
                }
                val discountRial = (discount.toBigDecimalOrNull() ?: BigDecimal.ZERO).multiply(BigDecimal.TEN).toLong()
                val taxRial = (tax.toBigDecimalOrNull() ?: BigDecimal.ZERO).multiply(BigDecimal.TEN).toLong()
                val extraCostsRial = if (kind == "PURCHASE") (extraCosts.toBigDecimalOrNull() ?: BigDecimal.ZERO).multiply(BigDecimal.TEN).toLong() else 0L
                onSave(kind, partyId, lines, discountRial, taxRial, extraCostsRial, warehouseId)
            }) { Text(if (existing == null) "ثبت و صدور فاکتور" else "ذخیره و ثبت نسخه ویرایش‌شده") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White)
}
@Composable
private fun ImportDialog(
    parties: List<PartyEntity>, existing: ImportOrderEntity? = null, onDismiss: () -> Unit,
    onSave: (Long, String, Long, String, Double, Long, Long, Long, Long, Int) -> Unit
) {
    val suppliers = parties.filter { it.kind != "CUSTOMER" }
    var supplierId by remember(existing?.id) { mutableStateOf(existing?.supplierId ?: suppliers.firstOrNull()?.id ?: 0L) }
    var currency by remember(existing?.id) { mutableStateOf(existing?.currency ?: "USD") }
    var rate by remember(existing?.id) { mutableStateOf((existing?.fxRateToRial ?: 600000L).toString()) }
    var container by remember(existing?.id) { mutableStateOf(existing?.containerCode ?: "") }
    var weight by remember(existing?.id) { mutableStateOf(existing?.grossWeightKg?.toString() ?: "") }
    var goods by remember(existing?.id) { mutableStateOf(existing?.goodsAmountMinor?.toString() ?: "") }
    var freight by remember(existing?.id) { mutableStateOf((existing?.freightRial ?: 0L).toString()) }
    var customs by remember(existing?.id) { mutableStateOf((existing?.customsRial ?: 0L).toString()) }
    var other by remember(existing?.id) { mutableStateOf((existing?.otherCostsRial ?: 0L).toString()) }
    var creditDays by remember(existing?.id) { mutableStateOf(existing?.let { ((it.supplierDueAt - it.orderedAt) / 86_400_000L).coerceAtLeast(0).toString() } ?: "90") }
    val valid = supplierId > 0L && container.isNotBlank() &&
        (rate.toLongOrNull() ?: 0L) > 0L &&
        (weight.toDoubleOrNull()?.let { it.isFinite() && it > 0.0 } == true) &&
        (goods.toLongOrNull() ?: 0L) > 0L &&
        listOf(freight, customs, other).all { (it.toLongOrNull() ?: -1L) >= 0L } &&
        (creditDays.toIntOrNull()?.let { it in 0..3650 } == true)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) "سفارش واردات نخ" else "ویرایش سفارش " + existing.containerCode) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ChoiceField("تأمین‌کننده", suppliers.firstOrNull { it.id == supplierId }?.name ?: "انتخاب تأمین‌کننده", suppliers.map { it.name }) {
                    supplierId = suppliers.firstOrNull { p -> p.name == it }?.id ?: 0L
                }
                ChoiceField("ارز", currency, listOf("USD", "CNY", "IRR")) { currency = it; if (it == "IRR") rate = "1" }
                FormField("نرخ هر واحد ارز به ریال", rate, KeyboardType.Number) { rate = it }
                FormField("شماره کانتینر", container) { container = it }
                FormField("وزن خالص (کیلوگرم)", weight, KeyboardType.Decimal) { weight = it }
                FormField("مبلغ خرید به ارز انتخابی", goods, KeyboardType.Number) { goods = it }
                FormField("حمل (ریال)", freight, KeyboardType.Number) { freight = it }
                FormField("گمرک (ریال)", customs, KeyboardType.Number) { customs = it }
                FormField("سایر هزینه‌ها (ریال)", other, KeyboardType.Number) { other = it }
                FormField("مهلت تسویه (روز)", creditDays, KeyboardType.Number) { creditDays = it }
            }
        },
        confirmButton = {
            TextButton(enabled = valid, onClick = {
                onSave(
                    supplierId, currency, rate.toLongOrNull() ?: 0L, container,
                    weight.toDoubleOrNull() ?: 0.0, goods.toLongOrNull() ?: 0L,
                    freight.toLongOrNull() ?: 0L, customs.toLongOrNull() ?: 0L,
                    other.toLongOrNull() ?: 0L, creditDays.toIntOrNull() ?: 0
                )
            }) { Text(if (existing == null) "ثبت سفارش" else "ذخیره تغییرات") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D),
        titleContentColor = Color.White,
        textContentColor = Color.White
    )
}

@Composable
private fun TreasuryDialog(
    parties: List<PartyEntity>,
    existing: ir.billion.holloopro.data.TreasuryEntryEntity? = null,
    onDismiss: () -> Unit,
    onSave: (String, String, Long, Long, String, String) -> Unit
) {
    var kind by remember(existing?.id) { mutableStateOf(existing?.kind ?: "RECEIPT") }
    var method by remember(existing?.id) { mutableStateOf(existing?.method ?: "CASH") }
    val eligible = parties.filter { if (kind == "RECEIPT") it.kind != "SUPPLIER" else it.kind != "CUSTOMER" }
    var partyId by remember(existing?.id) { mutableStateOf(existing?.partyId ?: eligible.firstOrNull()?.id ?: 0L) }
    var amount by remember(existing?.id) { mutableStateOf(existing?.amountRial?.let { BigDecimal(it).divide(BigDecimal.TEN).stripTrailingZeros().toPlainString() } ?: "") }
    var reference by remember(existing?.id) { mutableStateOf(existing?.referenceNumber ?: "") }
    var note by remember(existing?.id) { mutableStateOf(existing?.note ?: "") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) "ثبت دریافت یا پرداخت" else "ویرایش سند دریافت/پرداخت") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = kind == "RECEIPT", onClick = { kind = "RECEIPT"; partyId = parties.firstOrNull { it.kind != "SUPPLIER" }?.id ?: 0L }, label = { Text("دریافت") })
                    FilterChip(selected = kind == "PAYMENT", onClick = { kind = "PAYMENT"; partyId = parties.firstOrNull { it.kind != "CUSTOMER" }?.id ?: 0L }, label = { Text("پرداخت") })
                }
                ChoiceField("طرف حساب", eligible.firstOrNull { it.id == partyId }?.name ?: "انتخاب طرف حساب", eligible.map { it.name }) {
                    partyId = eligible.firstOrNull { p -> p.name == it }?.id ?: 0L
                }
                ChoiceField("محل ثبت", if (method == "CASH") "صندوق" else "بانک", listOf("صندوق", "بانک")) {
                    method = if (it == "صندوق") "CASH" else "BANK"
                }
                FormField("مبلغ (تومان)", amount, KeyboardType.Number) { amount = it }
                FormField("شماره پیگیری/رسید", reference) { reference = it }
                FormField("شرح", note) { note = it }
            }
        },
        confirmButton = {
            TextButton(enabled = partyId > 0L && (amount.toBigDecimalOrNull()?.compareTo(BigDecimal.ZERO) ?: 0) > 0, onClick = {
                val rial = (amount.toBigDecimalOrNull() ?: BigDecimal.ZERO).multiply(BigDecimal.TEN).longValueExact()
                onSave(kind, method, partyId, rial, reference, note)
            }) { Text(if (existing == null) "ثبت سند" else "ذخیره تغییرات") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D),
        titleContentColor = Color.White,
        textContentColor = Color.White
    )
}

@Composable
private fun FormField(label: String, value: String, keyboardType: KeyboardType = KeyboardType.Text, onValueChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, fontSize = 11.sp) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        modifier = Modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Turquoise,
            unfocusedBorderColor = Color(0xFF47657D),
            focusedLabelColor = Turquoise,
            unfocusedLabelColor = Muted,
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            cursorColor = Turquoise
        )
    )
}

@Composable
private fun ChoiceField(label: String, selected: String, options: List<String>, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxWidth()) {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.Start) {
                Text(label, color = Muted, fontSize = 9.sp)
                Text(selected.ifBlank { "انتخاب کنید" }, color = Color.White, fontSize = 12.sp)
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(text = { Text(option) }, onClick = { onSelect(option); expanded = false })
            }
        }
    }
}

private fun partyKind(kind: String): String = when (kind) {
    "CUSTOMER" -> "مشتری"
    "SUPPLIER" -> "تأمین‌کننده"
    else -> "مشتری و تأمین‌کننده"
}

private fun buildReportsCsv(
    products: List<ProductProfitRow>,
    invoices: List<InvoiceProfitRow>,
    kardex: List<WarehouseKardexRow>
): String {
    fun csv(value: String): String = "\"" + value.replace("\"", "\"\"") + "\""
    val out = StringBuilder("\uFEFF")
    out.appendLine("گزارش سودآوری کالا")
    out.appendLine("کالا,مقدار خالص فروش (کیلوگرم),فروش خالص (ریال),بهای تمام‌شده (ریال),سود (ریال)")
    products.forEach { row ->
        out.appendLine(listOf(csv(row.productName), row.quantitySoldKg.toString(), row.salesRial.toString(), row.costRial.toString(), row.profitRial.toString()).joinToString(","))
    }
    out.appendLine()
    out.appendLine("گزارش سودآوری فاکتور")
    out.appendLine("شماره فاکتور,طرف حساب,فروش خالص (ریال),بهای تمام‌شده (ریال),سود (ریال)")
    invoices.forEach { row ->
        out.appendLine(listOf(csv(row.invoiceNumber), csv(row.partyName), row.salesRial.toString(), row.costRial.toString(), row.profitRial.toString()).joinToString(","))
    }
    out.appendLine()
    out.appendLine("سودآوری طرف حساب")
    out.appendLine("طرف حساب,سود (ریال)")
    invoices.groupBy { it.partyId }.map { (_, rows) -> rows.first().partyName to rows.sumOf { it.profitRial } }
        .sortedByDescending { it.second }.forEach { (name, profit) ->
            out.appendLine(listOf(csv(name), profit.toString()).joinToString(","))
        }
    out.appendLine()
    out.appendLine("کاردکس انبارها")
    out.appendLine("تاریخ,انبار,کالا,نوع گردش,مقدار (کیلوگرم),مرجع,شرح")
    kardex.forEach { row ->
        val date = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(java.util.Date(row.createdAt))
        out.appendLine(listOf(csv(date), csv(row.warehouseName), csv(row.productName), csv(row.kind), row.quantityKg.toString(), row.referenceId.toString(), csv(row.note)).joinToString(","))
    }
    return out.toString()
}


private fun buildReportsPdf(
    products: List<ProductProfitRow>,
    invoices: List<InvoiceProfitRow>,
    kardex: List<WarehouseKardexRow>
): ByteArray {
    val document = android.graphics.pdf.PdfDocument()
    val pageWidth = 595
    val pageHeight = 842
    val margin = 36
    val bodyPaint = android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.BLACK
        textSize = 10f
    }
    val headingPaint = android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.BLACK
        textSize = 15f
        typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
    }
    val titlePaint = android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.BLACK
        textSize = 19f
        typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
    }
    var pageNumber = 1
    var page = document.startPage(android.graphics.pdf.PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
    var y = margin
    fun newPage() {
        document.finishPage(page)
        pageNumber += 1
        page = document.startPage(android.graphics.pdf.PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
        y = margin
    }
    fun drawTextLine(value: String, paint: android.text.TextPaint) {
        val layout = android.text.StaticLayout.Builder.obtain(value, 0, value.length, paint, pageWidth - margin * 2)
            .setAlignment(android.text.Layout.Alignment.ALIGN_OPPOSITE)
            .setTextDirection(android.text.TextDirectionHeuristics.RTL)
            .setLineSpacing(3f, 1f)
            .build()
        if (y + layout.height > pageHeight - margin) newPage()
        page.canvas.save()
        page.canvas.translate(margin.toFloat(), y.toFloat())
        layout.draw(page.canvas)
        page.canvas.restore()
        y += layout.height + 7
    }
    drawTextLine("هلو پرو پلاس - گزارش‌های مدیریتی", titlePaint)
    drawTextLine("گزارش سودآوری کالا", headingPaint)
    products.filter { it.quantitySoldKg > 0.000001 }.forEach { row ->
        drawTextLine(
            "${row.productName} | فروش خالص: ${formatMoney(row.salesRial, false)} ریال | بهای تمام‌شده: ${formatMoney(row.costRial, false)} ریال | سود: ${formatMoney(row.profitRial, false)} ریال | مقدار: ${formatQuantity(row.quantitySoldKg)} کیلو",
            bodyPaint
        )
    }
    drawTextLine("گزارش سودآوری فاکتور", headingPaint)
    invoices.forEach { row ->
        drawTextLine(
            "${row.invoiceNumber} | ${row.partyName} | فروش خالص: ${formatMoney(row.salesRial, false)} | بهای تمام‌شده: ${formatMoney(row.costRial, false)} | سود: ${formatMoney(row.profitRial, false)} ریال",
            bodyPaint
        )
    }
    drawTextLine("سودآوری طرف حساب", headingPaint)
    invoices.groupBy { it.partyId }.map { (_, rows) -> rows.first().partyName to rows.sumOf { it.profitRial } }
        .sortedByDescending { it.second }.forEach { (name, profit) ->
            drawTextLine("${name} | سود: ${formatMoney(profit, false)} ریال", bodyPaint)
        }
    drawTextLine("کاردکس انبارها - ۲۵۰ گردش اخیر", headingPaint)
    kardex.forEach { row ->
        val date = java.text.SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault()).format(java.util.Date(row.createdAt))
        drawTextLine(
            "${date} | ${row.warehouseName} | ${row.productName} | ${row.kind} | ${formatQuantity(row.quantityKg)} کیلو | ${row.note}",
            bodyPaint
        )
    }
    document.finishPage(page)
    return java.io.ByteArrayOutputStream().use { output ->
        document.writeTo(output)
        document.close()
        output.toByteArray()
    }
}

private fun formatMoney(rial: Long, showToman: Boolean): String {
    val value = if (showToman) Money.rialToToman(rial) else BigDecimal.valueOf(rial)
    val formatter = NumberFormat.getNumberInstance(Locale("fa", "IR")).apply {
        maximumFractionDigits = if (showToman) 1 else 0
        minimumFractionDigits = 0
    }
    return formatter.format(value)
}

private fun formatQuantity(value: Double): String =
    NumberFormat.getNumberInstance(Locale("fa", "IR")).apply { maximumFractionDigits = 3 }.format(value)
