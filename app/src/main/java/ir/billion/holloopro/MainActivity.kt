package ir.billion.holloopro

import android.os.Bundle
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ir.billion.holloopro.accounting.LandedCostCalculator
import ir.billion.holloopro.accounting.Money
import ir.billion.holloopro.data.ImportOrderEntity
import ir.billion.holloopro.data.AccountBalanceRow
import ir.billion.holloopro.data.InvoiceEntity
import ir.billion.holloopro.data.InvoiceLineInput
import ir.billion.holloopro.data.PartyEntity
import ir.billion.holloopro.data.ProductEntity
import ir.billion.holloopro.data.ProductWithStock
import ir.billion.holloopro.ui.AppViewModel
import kotlinx.coroutines.flow.StateFlow
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale

private val Navy = Color(0xFF071629)
private val NavyGlass = Color(0xCC102B46)
private val Turquoise = Color(0xFF36D6C5)
private val Muted = Color(0xFF9FB5C9)
private val CardBorder = Color(0x5536D6C5)

class MainActivity : ComponentActivity() {
    private val vm by viewModels<AppViewModel> {
        AppViewModel.Factory((application as HolooApplication).repository)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            HolooTheme {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    val products by vm.products.collectAsState()
                    val parties by vm.parties.collectAsState()
                    val partyBalances by vm.partyBalances.collectAsState()
                    val invoices by vm.invoices.collectAsState()
                    val imports by vm.imports.collectAsState()
                    val treasury by vm.treasury.collectAsState()
                    val accountBalances by vm.accountBalances.collectAsState()
                    val productCount by vm.productCount.collectAsState()
                    val partyCount by vm.partyCount.collectAsState()
                    val invoiceCount by vm.invoiceCount.collectAsState()
                    val voucherCount by vm.voucherCount.collectAsState()
                    val importCount by vm.importCount.collectAsState()
                    val message by vm.message.collectAsState()
                    HolooApp(
                        products, parties, partyBalances, invoices, imports, treasury, accountBalances,
                        productCount, partyCount, invoiceCount, voucherCount, importCount,
                        message,
                        onSaveProduct = vm::saveProduct,
                        onDeleteProduct = vm::deleteProduct,
                        onSaveParty = vm::saveParty,
                        onDeleteParty = vm::deleteParty,
                        onCreateInvoice = vm::createMultiLineInvoice,
                        onReverseInvoice = vm::reverseInvoice,
                        onAddImport = vm::addImport,
                        onAddTreasury = vm::addTreasury,
                        onClearMessage = vm::clearMessage
                    )
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
    INVENTORY("کالا و انبار", "▦"),
    PARTIES("اشخاص", "♙"),
    INVOICES("فاکتورها", "▤"),
    IMPORTS("واردات نخ", "▣"),
    ACCOUNTING("حسابداری", "≋")
}

@Composable
private fun HolooApp(
    products: List<ProductWithStock>,
    parties: List<PartyEntity>,
    partyBalances: List<ir.billion.holloopro.data.PartyBalanceRow>,
    invoices: List<InvoiceEntity>,
    imports: List<ImportOrderEntity>,
    treasury: List<ir.billion.holloopro.data.TreasuryEntryEntity>,
    accountBalances: List<AccountBalanceRow>,
    productCount: Int,
    partyCount: Int,
    invoiceCount: Int,
    voucherCount: Int,
    importCount: Int,
    message: String?,
    onSaveProduct: (Long?, String, String, String, String, String, Int, Boolean, String) -> Unit,
    onDeleteProduct: (Long) -> Unit,
    onSaveParty: (Long?, String, String, String, String, Long) -> Unit,
    onDeleteParty: (Long) -> Unit,
    onCreateInvoice: (String, Long, List<InvoiceLineInput>, Long, Long) -> Unit,
    onReverseInvoice: (Long) -> Unit,
    onAddImport: (Long, String, Long, String, Double, Long, Long, Long, Long, Int) -> Unit,
    onAddTreasury: (String, String, Long, Long, String, String) -> Unit,
    onClearMessage: () -> Unit
) {
    var screen by remember { mutableStateOf(Screen.HOME) }
    var showToman by remember { mutableStateOf(true) }
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
                TextButton(onClick = { showToman = !showToman }) {
                    Text(if (showToman) "نمایش تومان" else "نمایش ریال", color = Turquoise)
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
                Screen.HOME -> HomeScreen(productCount, partyCount, invoiceCount, voucherCount, importCount, showToman)
                Screen.INVENTORY -> InventoryScreen(products, showToman, onSaveProduct, onDeleteProduct)
                Screen.PARTIES -> PartiesScreen(parties, partyBalances, showToman, onSaveParty, onDeleteParty)
                Screen.INVOICES -> InvoicesScreen(parties, products, invoices, showToman, onCreateInvoice, onReverseInvoice)
                Screen.IMPORTS -> ImportsScreen(parties, imports, showToman, onAddImport)
                Screen.ACCOUNTING -> AccountingScreen(voucherCount, invoices, treasury, accountBalances, parties, showToman, onAddTreasury)
            }
        }
    }
}

@Composable
private fun HomeScreen(
    productCount: Int, partyCount: Int, invoiceCount: Int, voucherCount: Int, importCount: Int, showToman: Boolean
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
private fun InventoryScreen(
    products: List<ProductWithStock>, showToman: Boolean,
    onSave: (Long?, String, String, String, String, String, Int, Boolean, String) -> Unit,
    onDelete: (Long) -> Unit
) {
    var dialog by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<ProductEntity?>(null) }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        SectionHeader("کالا و انبار", "تعریف، ویرایش و کنترل موجودی کالاهای نخ") { editing = null; dialog = true }
        if (products.isEmpty()) EmptyState("هنوز کالایی ثبت نشده است", "برای شروع، کالای نخ جدید اضافه کن")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
            items(products, key = { it.product.id }) { item ->
                GlassCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(item.product.name, color = Color.White, fontWeight = FontWeight.Bold)
                            Text("${item.product.sku}  •  ${item.product.yarnType}  •  ${item.product.denier}D", color = Muted, fontSize = 11.sp)
                            Text("${item.product.groupName}  •  ${item.product.color}  •  ${if (item.product.twisted) "تاب‌دار" else "بدون‌تاب"}", color = Muted, fontSize = 11.sp)
                            Text("موجودی: ${formatQuantity(item.stockKg)} کیلوگرم", color = Turquoise, fontSize = 13.sp)
                        }
                        Column {
                            TextButton(onClick = { editing = item.product; dialog = true }) { Text("ویرایش", color = Turquoise) }
                            TextButton(onClick = { onDelete(item.product.id) }) { Text("حذف", color = Color(0xFFFF9D9D)) }
                        }
                    }
                }
            }
        }
    }
    if (dialog) ProductDialog(existing = editing, onDismiss = { dialog = false; editing = null }, onSave = { id,a,b,c,d,e,f,g,h -> onSave(id,a,b,c,d,e,f,g,h); dialog = false; editing = null })
}

@Composable
private fun PartiesScreen(
    parties: List<PartyEntity>, balances: List<ir.billion.holloopro.data.PartyBalanceRow>, showToman: Boolean,
    onSave: (Long?, String, String, String, String, Long) -> Unit, onDelete: (Long) -> Unit
) {
    var dialog by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<PartyEntity?>(null) }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        SectionHeader("اشخاص و طرف حساب", "ثبت، ویرایش و مشاهده مانده مشتری و تأمین‌کننده") { editing = null; dialog = true }
        if (parties.isEmpty()) EmptyState("فهرست اشخاص خالی است", "مشتری‌ها و تأمین‌کنندگان را ثبت کن")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
            items(parties, key = { it.id }) { party ->
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
    parties: List<PartyEntity>, products: List<ProductWithStock>, invoices: List<InvoiceEntity>, showToman: Boolean,
    onCreate: (String, Long, List<InvoiceLineInput>, Long, Long) -> Unit, onReverse: (Long) -> Unit
) {
    var dialog by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        SectionHeader("فاکتور خرید و فروش", "ثبت سند، کنترل موجودی و برگشت فاکتور") { dialog = true }
        if (invoices.isEmpty()) EmptyState("فاکتوری ثبت نشده است", "برای ثبت خرید یا فروش، فاکتور جدید بساز")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
            items(invoices, key = { it.id }) { invoice ->
                val partyName = parties.firstOrNull { it.id == invoice.partyId }?.name ?: "طرف حساب"
                GlassCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(if (invoice.kind == "SALE") "فروش به $partyName" else "خرید از $partyName", color = Color.White, fontWeight = FontWeight.Bold)
                            Text(invoice.number, color = Muted, fontSize = 10.sp)
                            Text("${formatMoney(invoice.totalRial, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Turquoise)
                            Text(if (invoice.status == "POSTED") "ثبت‌شده" else "برگشت‌شده", color = Muted, fontSize = 11.sp)
                        }
                        if (invoice.status == "POSTED") TextButton(onClick = { onReverse(invoice.id) }) {
                            Text("برگشت", color = Color(0xFFFFA4A4))
                        }
                    }
                }
            }
        }
    }
    if (dialog) InvoiceDialog(parties, products, onDismiss = { dialog = false }, onSave = { kind, partyId, lines, discount, tax -> onCreate(kind, partyId, lines, discount, tax); dialog = false })
}

@Composable
private fun ImportsScreen(
    parties: List<PartyEntity>, imports: List<ImportOrderEntity>, showToman: Boolean,
    onAdd: (Long, String, Long, String, Double, Long, Long, Long, Long, Int) -> Unit
) {
    var dialog by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        SectionHeader("واردات نخ از چین", "ارز، کانتینر، هزینه‌ها و سررسید تأمین‌کننده") { dialog = true }
        if (imports.isEmpty()) EmptyState("سفارشی ثبت نشده است", "اطلاعات خرید خارجی و هزینه‌های حمل را وارد کن")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
            items(imports, key = { it.id }) { order ->
                val supplier = parties.firstOrNull { it.id == order.supplierId }?.name ?: "تأمین‌کننده"
                val total = runCatching {
                    LandedCostCalculator.totalCostRial(
                        order.goodsAmountMinor, order.fxRateToRial,
                        order.freightRial, order.customsRial, order.otherCostsRial
                    )
                }.getOrDefault(0L)
                val perKg = runCatching { LandedCostCalculator.costPerKgRial(total, order.grossWeightKg) }.getOrDefault(0L)
                GlassCard {
                    Text("کانتینر ${order.containerCode}", color = Color.White, fontWeight = FontWeight.Bold)
                    Text("$supplier  •  ${order.currency}", color = Muted, fontSize = 11.sp)
                    Text("وزن: ${formatQuantity(order.grossWeightKg)} کیلوگرم", color = Muted, fontSize = 12.sp)
                    Text("بهای تمام‌شده هر کیلو: ${formatMoney(perKg, showToman)} ${if (showToman) "تومان" else "ریال"}", color = Turquoise)
                    Text("سررسید تسویه: ${java.text.SimpleDateFormat("yyyy/MM/dd", Locale.getDefault()).format(java.util.Date(order.supplierDueAt))}", color = Muted, fontSize = 11.sp)
                }
            }
        }
    }
    if (dialog) ImportDialog(parties, onDismiss = { dialog = false }, onSave = { a,b,c,d,e,f,g,h,i,j -> onAdd(a,b,c,d,e,f,g,h,i,j); dialog = false })
}

@Composable
private fun AccountingScreen(
    voucherCount: Int,
    invoices: List<InvoiceEntity>,
    treasury: List<ir.billion.holloopro.data.TreasuryEntryEntity>,
    accountBalances: List<AccountBalanceRow>,
    parties: List<PartyEntity>,
    showToman: Boolean,
    onAddTreasury: (String, String, Long, Long, String, String) -> Unit
) {
    var showDialog by remember { mutableStateOf(false) }
    val sales = invoices.filter { it.kind == "SALE" && it.status == "POSTED" }.sumOf { it.totalRial }
    val purchases = invoices.filter { it.kind == "PURCHASE" && it.status == "POSTED" }.sumOf { it.totalRial }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("دفتر و حسابداری دوبل", modifier = Modifier.weight(1f), color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Button(onClick = { showDialog = true }, colors = ButtonDefaults.buttonColors(containerColor = Turquoise, contentColor = Navy)) {
                    Text("دریافت/پرداخت")
                }
            }
        }
        item { StatCard("اسناد صادرشده", voucherCount.toString(), "≋", Modifier.fillMaxWidth()) }
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
                Text("کدینگ پایه", color = Turquoise, fontWeight = FontWeight.Bold)
                Text("۱۱۰۱ صندوق  •  ۱۱۰۲ بانک", color = Color.White, fontSize = 12.sp)
                Text("۱۱۰۳ دریافتنی  •  ۱۳۰۱ موجودی کالا", color = Color.White, fontSize = 12.sp)
                Text("۲۱۰۱ پرداختنی  •  ۴۱۰۱ فروش", color = Color.White, fontSize = 12.sp)
                Text("اسناد فاکتور و دریافت/پرداخت به‌صورت دوبل ثبت می‌شوند. دفتر کل تفصیلی، چک و گزارش سود نهایی هنوز در برنامه توسعه هستند.", color = Muted, fontSize = 11.sp)
            }
        }
    }
    if (showDialog) {
        TreasuryDialog(
            parties,
            onDismiss = { showDialog = false },
            onSave = { a, b, c, d, e, f -> onAddTreasury(a, b, c, d, e, f); showDialog = false }
        )
    }
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

private class InvoiceDraftRow(initialProductId: Long) {
    var productId by mutableStateOf(initialProductId)
    var quantity by mutableStateOf("1")
    var price by mutableStateOf("")
}

@Composable
private fun InvoiceDialog(parties: List<PartyEntity>, products: List<ProductWithStock>, onDismiss: () -> Unit, onSave: (String, Long, List<InvoiceLineInput>, Long, Long) -> Unit) {
    var kind by remember { mutableStateOf("SALE") }
    val eligibleParties = parties.filter { if (kind == "SALE") it.kind != "SUPPLIER" else it.kind != "CUSTOMER" }
    var partyId by remember { mutableStateOf(eligibleParties.firstOrNull()?.id ?: 0L) }
    val rows = remember { mutableStateListOf(InvoiceDraftRow(products.firstOrNull()?.product?.id ?: 0L)) }
    var discount by remember { mutableStateOf("0") }
    var tax by remember { mutableStateOf("0") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("فاکتور چندردیفی") },
        text = {
            Column(modifier = Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = kind == "SALE", onClick = { kind = "SALE"; partyId = parties.firstOrNull { it.kind != "SUPPLIER" }?.id ?: 0L }, label = { Text("فروش") })
                    FilterChip(selected = kind == "PURCHASE", onClick = { kind = "PURCHASE"; partyId = parties.firstOrNull { it.kind != "CUSTOMER" }?.id ?: 0L }, label = { Text("خرید") })
                }
                ChoiceField("طرف حساب", parties.firstOrNull { it.id == partyId }?.name ?: "انتخاب طرف حساب", eligibleParties.map { it.name }) { selected -> partyId = eligibleParties.firstOrNull { it.name == selected }?.id ?: 0L }
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
                Text("قیمت‌ها در پایگاه داده به ریال ذخیره می‌شوند. موجودی هر ردیف هنگام ثبت کنترل می‌شود.", color = Muted, fontSize = 10.sp)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val lines = rows.mapNotNull { row ->
                    val quantity = row.quantity.toDoubleOrNull() ?: 0.0
                    val priceRial = (row.price.toBigDecimalOrNull() ?: BigDecimal.ZERO).multiply(BigDecimal.TEN).toLong()
                    if (row.productId > 0 && quantity > 0 && priceRial > 0) InvoiceLineInput(row.productId, quantity, priceRial) else null
                }
                val discountRial = (discount.toBigDecimalOrNull() ?: BigDecimal.ZERO).multiply(BigDecimal.TEN).toLong()
                val taxRial = (tax.toBigDecimalOrNull() ?: BigDecimal.ZERO).multiply(BigDecimal.TEN).toLong()
                onSave(kind, partyId, lines, discountRial, taxRial)
            }) { Text("ثبت و صدور سند") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } },
        containerColor = Color(0xFF15324D), titleContentColor = Color.White, textContentColor = Color.White)
}
@Composable
private fun ImportDialog(
    parties: List<PartyEntity>, onDismiss: () -> Unit,
    onSave: (Long, String, Long, String, Double, Long, Long, Long, Long, Int) -> Unit
) {
    val suppliers = parties.filter { it.kind != "CUSTOMER" }
    var supplierId by remember { mutableStateOf(suppliers.firstOrNull()?.id ?: 0L) }
    var currency by remember { mutableStateOf("USD") }
    var rate by remember { mutableStateOf("600000") }
    var container by remember { mutableStateOf("") }
    var weight by remember { mutableStateOf("") }
    var goods by remember { mutableStateOf("") }
    var freight by remember { mutableStateOf("0") }
    var customs by remember { mutableStateOf("0") }
    var other by remember { mutableStateOf("0") }
    var creditDays by remember { mutableStateOf("90") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("سفارش واردات نخ") },
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
            TextButton(onClick = {
                onSave(
                    supplierId, currency, rate.toLongOrNull() ?: 0L, container,
                    weight.toDoubleOrNull() ?: 0.0, goods.toLongOrNull() ?: 0L,
                    freight.toLongOrNull() ?: 0L, customs.toLongOrNull() ?: 0L,
                    other.toLongOrNull() ?: 0L, creditDays.toIntOrNull() ?: 0
                )
            }) { Text("ثبت سفارش") }
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
    onDismiss: () -> Unit,
    onSave: (String, String, Long, Long, String, String) -> Unit
) {
    var kind by remember { mutableStateOf("RECEIPT") }
    var method by remember { mutableStateOf("CASH") }
    val eligible = parties.filter { if (kind == "RECEIPT") it.kind != "SUPPLIER" else it.kind != "CUSTOMER" }
    var partyId by remember { mutableStateOf(eligible.firstOrNull()?.id ?: 0L) }
    var amount by remember { mutableStateOf("") }
    var reference by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("ثبت دریافت یا پرداخت") },
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
            TextButton(onClick = {
                val rial = (amount.toBigDecimalOrNull() ?: BigDecimal.ZERO).multiply(BigDecimal.TEN).toLong()
                onSave(kind, method, partyId, rial, reference, note)
            }) { Text("ثبت سند") }
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
