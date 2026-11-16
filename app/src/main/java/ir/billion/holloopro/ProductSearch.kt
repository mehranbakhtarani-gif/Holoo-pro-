package ir.billion.holloopro

import ir.billion.holloopro.data.ProductWithStock
import java.util.Locale

internal fun filterProducts(products: List<ProductWithStock>, query: String): List<ProductWithStock> {
    val needle = query.trim().lowercase(Locale.ROOT)
    if (needle.isEmpty()) return products
    return products.filter { item ->
        val product = item.product
        listOf(
            product.sku,
            product.name,
            product.groupName,
            product.yarnType,
            product.color,
            "${product.denier}D",
            product.denier.toString(),
            if (product.twisted) "تاب‌دار" else "بدون‌تاب"
        ).any { value -> value.lowercase(Locale.ROOT).contains(needle) }
    }
}
