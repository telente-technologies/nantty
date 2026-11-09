package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Locale

internal data class SellerCatalogImage(val mediaId: String, val url: String)
internal data class SellerCatalogOption(val name: String, val values: List<String>)
internal data class SellerCatalogStock(val locationId: String, val onHand: Int, val reserved: Int)
internal data class SellerCatalogVariant(
    val id: String,
    val optionValues: Map<String, String>,
    val sku: String,
    val barcode: String?,
    val priceMinor: Long,
    val currency: String,
    val compareAtPriceMinor: Long?,
    val costPriceMinor: Long?,
    val lowStockThreshold: Int,
    val stock: List<SellerCatalogStock>,
)
internal data class SellerCatalogBrand(val id: String, val name: String, val handle: String)
internal data class SellerCatalogLocation(val id: String, val name: String, val active: Boolean, val isDefault: Boolean)

internal data class SellerCatalogProduct(
    val id: String,
    val name: String,
    val description: String,
    val categoryId: String?,
    val status: String,
    val publishedOnline: Boolean,
    val imageUrl: String?,
    val images: List<SellerCatalogImage>,
    val options: List<SellerCatalogOption>,
    val variants: List<SellerCatalogVariant>,
    val taxable: Boolean,
    val trackInventory: Boolean,
    val tags: List<String>,
    val brand: SellerCatalogProductBrand?,
) {
    val variantCount: Int get() = variants.size
}

internal data class SellerCatalogProductBrand(val brandId: String, val name: String?, val relationship: String)
internal data class SellerCatalogOptionDraft(val name: String, val valuesText: String, val originalName: String? = null) {
    val values: List<String> get() = valuesText.split(',', '\n', ';').map(String::trim).filter(String::isNotEmpty)
}
internal data class SellerCatalogVariantDraft(val optionValues: Map<String, String>)
internal data class SellerCatalogForm(
    val name: String,
    val description: String,
    val priceMajorText: String,
    val stockText: String,
    val options: List<SellerCatalogOptionDraft>,
)

internal data class SellerCatalogUpsert(
    val form: SellerCatalogForm,
    val product: SellerCatalogProduct?,
    val images: List<SellerCatalogImage>,
    val brand: SellerCatalogProductBrand?,
    val defaultLocationId: String?,
    val skuSeed: String,
)

internal data class SellerCatalogMutation(val method: String, val path: String, val body: JSONObject?, val idempotencyKey: String?)

internal fun parseSellerCatalogProduct(payload: JSONObject, expectedId: String? = null): SellerCatalogProduct {
    val row = payload.optJSONObject("data") ?: payload
    val id = row.optString("id").takeIf(::isSafeMartIdentifier) ?: error("Nantty returned an invalid product.")
    require(expectedId == null || expectedId == id) { "Nantty returned a different product than requested." }
    val images = row.optJSONArray("images").toSellerCatalogImages()
    val options = row.optJSONArray("options").toSellerCatalogOptions()
    val variants = row.optJSONArray("variants").toSellerCatalogVariants()
    val brandObject = row.optJSONObject("brand")
    val brand = brandObject?.let {
        val brandId = it.optString("brandId").ifBlank { it.optString("id") }
        if (!isSafeMartIdentifier(brandId)) null else SellerCatalogProductBrand(
            brandId,
            it.optString("name").takeIf(String::isNotBlank),
            it.optString("relationship").takeIf { relationship -> relationship in SELLER_CATALOG_BRAND_RELATIONSHIPS }
                ?: "genuine_resale",
        )
    }
    return SellerCatalogProduct(
        id = id,
        name = row.optString("name").trim().also { require(it.isNotEmpty()) },
        description = row.optString("description"),
        categoryId = row.optString("categoryId").takeUnless { it.isBlank() || it == "null" }?.takeIf(::isSafeMartIdentifier),
        status = row.optString("status").takeIf { it in SELLER_CATALOG_PRODUCT_STATUSES }
            ?: error("Nantty returned an unsupported product status."),
        publishedOnline = row.optBoolean("publishedOnline"),
        imageUrl = images.firstOrNull()?.url,
        images = images,
        options = options,
        variants = variants,
        taxable = row.optBoolean("taxable", true),
        trackInventory = row.optBoolean("trackInventory", true),
        tags = row.optJSONArray("tags").toSellerCatalogStrings(),
        brand = brand,
    )
}

internal fun parseSellerCatalogLocations(payload: JSONObject): List<SellerCatalogLocation> {
    val rows = payload.optJSONArray("data") ?: payload.optJSONObject("data")?.optJSONArray("items")
        ?: error("Nantty returned an incomplete store locations response.")
    return buildList {
        for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: continue
            val id = row.optString("id").takeIf(::isSafeMartIdentifier) ?: continue
            add(SellerCatalogLocation(id, row.optString("name"), row.optBoolean("active"), row.optBoolean("isDefault")))
        }
    }
}

internal fun parseSellerCatalogBrands(payload: JSONObject): List<SellerCatalogBrand> {
    val rows = payload.optJSONArray("data") ?: payload.optJSONObject("data")?.optJSONArray("items")
        ?: error("Nantty returned an incomplete brand list.")
    return buildList {
        for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: continue
            val id = row.optString("id").takeIf(::isSafeMartIdentifier) ?: continue
            val name = row.optString("name").trim().takeIf(String::isNotEmpty) ?: continue
            add(SellerCatalogBrand(id, name, row.optString("handle")))
        }
    }
}

internal fun buildSellerCatalogProductBody(input: SellerCatalogUpsert): SellerCatalogMutation? {
    val name = input.form.name.trim()
    val description = input.form.description.trim()
    if (name.length !in 2..120 || description.length > 5_000 || input.images.size > SELLER_CATALOG_IMAGE_LIMIT) return null
    val options = normalizedOptions(input.form.options)
    if (options.size > SELLER_CATALOG_OPTION_LIMIT || options.any { option ->
            option.name.length !in 1..30 || option.name.toByteArray(Charsets.UTF_8).size > 30 ||
                option.values.isEmpty() || option.values.size > SELLER_CATALOG_OPTION_VALUE_LIMIT ||
                option.values.any { it.length > 40 || it.toByteArray(Charsets.UTF_8).size > 40 }
        }) return null
    val optionNames = options.map(SellerCatalogOptionDraft::name)
    if (optionNames.map { it.lowercase() }.distinct().size != optionNames.size) return null
    val variantCount = options.fold(1L) { count, option -> count * option.values.size }
    if (variantCount !in 1..SELLER_CATALOG_VARIANT_LIMIT.toLong()) return null
    val priceMinor = parseSellerCatalogMinorUnits(input.form.priceMajorText) ?: return null
    if (priceMinor <= 0) return null
    val quantity = if (input.product == null) input.form.stockText.toIntOrNull() ?: return null else 0
    if (quantity !in 0..SELLER_CATALOG_MAX_STOCK) return null
    if (input.product == null && quantity > 0 && input.defaultLocationId?.let(::isSafeMartIdentifier) != true) return null
    if (input.brand != null && (!isSafeMartIdentifier(input.brand.brandId) || input.brand.relationship !in SELLER_CATALOG_BRAND_RELATIONSHIPS)) return null

    val combinations = buildList<Map<String, String>> {
        fun visit(index: Int, values: Map<String, String>) {
            if (index == options.size) { add(values); return }
            val option = options[index]
            option.values.forEach { value -> visit(index + 1, values + (option.name to value)) }
        }
        visit(0, emptyMap())
    }
    val existingVariants = input.product?.variants.orEmpty()
    val variants = JSONArray()
    combinations.forEachIndexed { index, values ->
        val old = existingVariants.firstOrNull { variant -> matchesSellerCatalogVariant(variant, options, values) }
        val openingStock = JSONArray()
        if (input.product == null && quantity > 0) {
            openingStock.put(JSONObject().put("locationId", input.defaultLocationId).put("quantity", quantity))
        }
        val safeSeed = input.skuSeed.filter(Char::isLetterOrDigit).uppercase(Locale.ROOT).takeLast(12).ifBlank { "ITEM" }
        variants.put(JSONObject()
            .put("id", old?.id ?: JSONObject.NULL)
            .put("optionValues", JSONObject(values))
            .put("sku", old?.sku ?: "NT-$safeSeed-${index + 1}".take(64))
            .put("barcode", old?.barcode ?: JSONObject.NULL)
            .put("priceMinor", priceMinor)
            .put("compareAtPriceMinor", old?.compareAtPriceMinor?.takeIf { it > priceMinor } ?: JSONObject.NULL)
            .put("costPriceMinor", old?.costPriceMinor ?: JSONObject.NULL)
            .put("regionalPrices", JSONArray())
            .put("lowStockThreshold", old?.lowStockThreshold ?: 5)
            .put("reorderPoint", JSONObject.NULL).put("reorderQuantity", JSONObject.NULL)
            .put("weightGrams", JSONObject.NULL).put("lengthMm", JSONObject.NULL)
            .put("widthMm", JSONObject.NULL).put("heightMm", JSONObject.NULL)
            .put("openingStock", openingStock))
    }
    val optionArray = JSONArray().apply {
        options.forEach { option -> put(JSONObject().put("name", option.name).put("values", JSONArray(option.values))) }
    }
    val body = JSONObject()
        .put("name", name).put("description", description)
        .put("categoryId", input.product?.categoryId ?: JSONObject.NULL)
        .put("status", input.product?.status ?: "active")
        .put("taxable", input.product?.taxable ?: true)
        .put("trackInventory", input.product?.trackInventory ?: true)
        .put("publishedOnline", input.product?.publishedOnline ?: true)
        .put("tags", JSONArray(input.product?.tags.orEmpty()))
        .put("options", optionArray)
        .put("imageMediaIds", JSONArray().apply { input.images.forEach { put(it.mediaId) } })
        .put("variants", variants)
        .put("brand", input.brand?.let { JSONObject().put("brandId", it.brandId).put("relationship", it.relationship) } ?: JSONObject.NULL)
    return if (input.product == null) {
        val key = input.skuSeed.takeIf { it.matches(Regex("^[A-Za-z0-9_-]{16,128}$")) } ?: return null
        SellerCatalogMutation("POST", SellerCatalogRepository.PRODUCTS_COLLECTION_PATH, body, key)
    } else {
        SellerCatalogMutation("PATCH", SellerCatalogRepository.productPath(input.product.id), body, null)
    }
}

internal fun validateSellerCatalogForm(input: SellerCatalogUpsert): String? = when {
    input.form.name.trim().length !in 2..120 -> "Give your product a name of 2 to 120 characters."
    input.form.description.length > 5_000 -> "Keep the description under 5,000 characters."
    input.images.size > SELLER_CATALOG_IMAGE_LIMIT -> "You can add up to $SELLER_CATALOG_IMAGE_LIMIT photos."
    normalizedOptions(input.form.options).size > SELLER_CATALOG_OPTION_LIMIT -> "A product can have up to $SELLER_CATALOG_OPTION_LIMIT options."
    normalizedOptions(input.form.options).any { option -> option.name.isBlank() || option.name.toByteArray(Charsets.UTF_8).size > 30 || option.values.isEmpty() || option.values.size > SELLER_CATALOG_OPTION_VALUE_LIMIT || option.values.any { it.isBlank() || it.toByteArray(Charsets.UTF_8).size > 40 } || option.values.map { it.lowercase() }.distinct().size != option.values.size } -> "Check each option name and its values."
    normalizedOptions(input.form.options).map { it.name.lowercase() }.distinct().size != normalizedOptions(input.form.options).size -> "Option names must be unique."
    normalizedOptions(input.form.options).fold(1L) { n, option -> n * option.values.size } > SELLER_CATALOG_VARIANT_LIMIT -> "These options create more than $SELLER_CATALOG_VARIANT_LIMIT variants."
    parseSellerCatalogMinorUnits(input.form.priceMajorText)?.let { it > 0 } != true -> "Enter a price above zero."
    input.product == null && input.form.stockText.toIntOrNull() == null -> "Enter how many you have in stock."
    input.product == null && (input.form.stockText.toIntOrNull()?.let { it !in 0..SELLER_CATALOG_MAX_STOCK } ?: true) -> "Enter a stock amount from 0 to $SELLER_CATALOG_MAX_STOCK."
    input.product == null && input.form.stockText.toIntOrNull()?.let { it > 0 } == true && input.defaultLocationId == null -> "Add a store location in your seller dashboard before adding stock."
    input.product != null && removedStockVariants(input).isNotEmpty() -> "Set stock to 0 in inventory before removing a variant with stock."
    else -> null
}

internal fun sellerCatalogForm(product: SellerCatalogProduct?): SellerCatalogForm {
    val lowest = product?.variants?.minOfOrNull(SellerCatalogVariant::priceMinor)
    val stock = product?.variants?.sumOf { variant -> variant.stock.sumOf { (it.onHand - it.reserved).coerceAtLeast(0) } } ?: 0
    return SellerCatalogForm(
        name = product?.name.orEmpty(), description = product?.description.orEmpty(),
        priceMajorText = lowest?.let { BigDecimal.valueOf(it, 2).toPlainString() }.orEmpty(),
        stockText = if (product == null) "" else stock.toString(),
        options = product?.options?.map { SellerCatalogOptionDraft(it.name, it.values.joinToString(", "), it.name) }.orEmpty(),
    )
}

internal fun parseSellerCatalogMinorUnits(value: String): Long? = runCatching {
    BigDecimal(value.trim()).movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact()
}.getOrNull()

internal fun normalizedOptions(drafts: List<SellerCatalogOptionDraft>): List<SellerCatalogOptionDraft> = drafts.map { draft ->
    draft.copy(name = draft.name.trim(), valuesText = draft.values.joinToString(", "))
}.filter { it.name.isNotEmpty() || it.values.isNotEmpty() }

private fun removedStockVariants(input: SellerCatalogUpsert): List<SellerCatalogVariant> {
    val product = input.product ?: return emptyList()
    val options = normalizedOptions(input.form.options)
    val combinations = buildList<Map<String, String>> {
        fun visit(index: Int, values: Map<String, String>) {
            if (index == options.size) { add(values); return }
            options[index].values.forEach { visit(index + 1, values + (options[index].name to it)) }
        }
        visit(0, emptyMap())
    }
    val retainedIds = product.variants.filter { variant ->
        combinations.any { values -> matchesSellerCatalogVariant(variant, options, values) }
    }.mapTo(mutableSetOf(), SellerCatalogVariant::id)
    return product.variants.filter { it.id !in retainedIds && it.stock.any { level -> level.onHand != 0 } }
}

private fun matchesSellerCatalogVariant(
    variant: SellerCatalogVariant,
    options: List<SellerCatalogOptionDraft>,
    values: Map<String, String>,
): Boolean {
    if (options.isEmpty()) return variant.optionValues.isEmpty()
    return options.all { option ->
        val oldValue = option.originalName?.let(variant.optionValues::get)
            ?: if (option.originalName == null) option.values.firstOrNull() else null
        values[option.name] == oldValue
    }
}

internal const val SELLER_CATALOG_IMAGE_LIMIT = 10
internal const val SELLER_CATALOG_OPTION_LIMIT = 3
internal const val SELLER_CATALOG_OPTION_VALUE_LIMIT = 30
internal const val SELLER_CATALOG_VARIANT_LIMIT = 100
internal const val SELLER_CATALOG_MAX_STOCK = 1_000_000
internal val SELLER_CATALOG_BRAND_RELATIONSHIPS = setOf("own", "authorised_reseller", "genuine_resale")
internal val SELLER_CATALOG_PRODUCT_STATUSES = setOf("draft", "active", "archived")

private fun JSONArray?.toSellerCatalogImages(): List<SellerCatalogImage> = buildList {
    if (this@toSellerCatalogImages == null) return@buildList
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: continue
        val mediaId = row.optString("mediaId").takeIf(::isSafeMartIdentifier) ?: continue
        val url = row.optString("url").takeIf(::isSafeSellerCatalogImageUrl) ?: continue
        add(SellerCatalogImage(mediaId, url))
    }
}

private fun JSONArray?.toSellerCatalogOptions(): List<SellerCatalogOption> = buildList {
    if (this@toSellerCatalogOptions == null) return@buildList
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: continue
        val name = row.optString("name").trim().takeIf(String::isNotEmpty) ?: continue
        add(SellerCatalogOption(name, row.optJSONArray("values").toSellerCatalogStrings()))
    }
}

private fun JSONArray?.toSellerCatalogVariants(): List<SellerCatalogVariant> = buildList {
    if (this@toSellerCatalogVariants == null) return@buildList
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: continue
        val id = row.optString("id").takeIf(::isSafeMartIdentifier) ?: continue
        val price = row.optJSONObject("price") ?: continue
        val amount = price.optLong("amountMinor", -1L)
        val currency = price.optString("currency")
        if (amount < 0 || !currency.matches(Regex("[A-Z]{3}"))) continue
        val stocks = row.optJSONArray("stock")
        val stock = buildList {
            if (stocks != null) for (stockIndex in 0 until stocks.length()) {
                val level = stocks.optJSONObject(stockIndex) ?: continue
                val locationId = level.optString("locationId").takeIf(::isSafeMartIdentifier) ?: continue
                add(SellerCatalogStock(locationId, level.optInt("onHand").coerceAtLeast(0), level.optInt("reserved").coerceAtLeast(0)))
            }
        }
        val optionValues = buildMap {
            val values = row.optJSONObject("optionValues") ?: JSONObject()
            values.keys().forEach { key -> values.optString(key).takeIf(String::isNotBlank)?.let { put(key, it) } }
        }
        add(SellerCatalogVariant(
            id, optionValues, row.optString("sku"), row.optString("barcode").takeIf(String::isNotBlank), amount, currency,
            row.optJSONObject("compareAtPrice")?.optLong("amountMinor")?.takeIf { it >= 0 },
            row.optJSONObject("costPrice")?.optLong("amountMinor")?.takeIf { it >= 0 },
            row.optInt("lowStockThreshold", 5).coerceAtLeast(0), stock,
        ))
    }
}

private fun JSONArray?.toSellerCatalogStrings(): List<String> = buildList {
    if (this@toSellerCatalogStrings == null) return@buildList
    for (index in 0 until length()) optString(index).takeIf(String::isNotBlank)?.let(::add)
}
