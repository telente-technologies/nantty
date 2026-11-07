package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject

internal object MartResponseParser {
    fun parseHome(body: String): MartResult.Home {
        val root = JSONObject(body)
        val rows = root.optJSONArray("categories") ?: JSONArray()
        val categories = buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val id = item.optString("id")
                val name = item.optString("name").trim()
                if (isSafeMartIdentifier(id) && name.isNotEmpty()) add(MartCategory(id, name, item.optInt("depth").coerceAtLeast(0)))
            }
        }
        return MartResult.Home(
            MartHome(
                categories = categories,
                salesOfTheDayImageUrl = safeMediaUrl(root.optNullableString("salesOfTheDayImageUrl")),
                featuredBrandsImageUrl = safeMediaUrl(root.optNullableString("featuredBrandsImageUrl")),
                newArrivalsImageUrl = safeMediaUrl(root.optNullableString("newArrivalsImageUrl")),
            ),
        )
    }

    fun parseProducts(body: String): MartResult.Products {
        val root = JSONObject(body)
        val rows = root.optJSONArray("data") ?: JSONArray()
        val products = buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val id = item.optString("id")
                val name = item.optString("name").trim()
                val price = item.optJSONObject("price") ?: continue
                val amount = price.optLong("amountMinor", -1)
                val currency = price.optString("currency")
                if (!isSafeMartIdentifier(id) || name.isEmpty() || amount < 0 || !currency.matches(Regex("[A-Z]{3}"))) continue
                add(
                    MartProduct(
                        id = id,
                        name = name,
                        amountMinor = amount,
                        currency = currency,
                        imageUrl = safeMediaUrl(item.optString("imageUrl").takeUnless { it.isBlank() || it == "null" }),
                        stock = item.optInt("stock").coerceAtLeast(0),
                    ),
                )
            }
        }
        return MartResult.Products(MartPage(products, root.optString("nextCursor").takeUnless { it.isBlank() || it == "null" }))
    }

    fun parseHighlights(body: String): MartResult.Highlights {
        val root = JSONObject(body)
        val rows = root.optJSONArray("data") ?: JSONArray()
        val highlights = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id")
                val title = row.optString("title").trim()
                val kind = row.optString("kind").trim()
                val targetJson = row.optJSONObject("target") ?: continue
                if (!isSafeMartIdentifier(id) || title.isEmpty() || kind.isEmpty()) continue
                val targetName = targetJson.optString("name").trim()
                if (targetName.isEmpty()) continue
                val target = when (targetJson.optString("type")) {
                    "product" -> targetJson.optString("productId").takeIf(::isSafeMartIdentifier)?.let { MartHighlightTarget.Product(it, targetName) }
                    "collection" -> targetJson.optString("collection").takeIf { it in MART_PRODUCT_COLLECTIONS }?.let { MartHighlightTarget.Collection(it, targetName) }
                    "category" -> targetJson.optString("categoryId").takeIf(::isSafeMartIdentifier)?.let { MartHighlightTarget.Category(it, targetName) }
                    else -> null
                } ?: continue
                val ranking = row.optJSONObject("ranking")?.optJSONObject("reason")
                val sponsored = row.optJSONObject("sponsored")?.let { sponsoredJson ->
                    val campaignId = sponsoredJson.optString("campaignId")
                    val impressionToken = sponsoredJson.optString("impressionToken")
                    if (isSafeMartIdentifier(campaignId) && impressionToken.isNotBlank() && impressionToken.length <= 2_000) {
                        MartSponsoredPlacement(
                            campaignId = campaignId,
                            label = sponsoredJson.optString("label").trim().ifEmpty { "Sponsored" },
                            advertiserName = sponsoredJson.optString("advertiserName").trim(),
                            impressionToken = impressionToken,
                        )
                    } else null
                }
                add(
                    MartHighlight(
                        id = id,
                        kind = kind,
                        title = title,
                        subtitle = row.optNullableString("subtitle"),
                        imageUrl = safeMediaUrl(row.optNullableString("imageUrl")),
                        target = target,
                        reasonLabel = ranking?.optString("label")?.trim().orEmpty(),
                        sponsored = sponsored,
                    ),
                )
            }
        }
        return MartResult.Highlights(highlights)
    }

    fun parseRecommendations(body: String): MartRecommendations {
        val root = JSONObject(body)
        val source = root.optString("source")
        require(source == "personalized" || source == "popular") { "Recommendation source is invalid." }
        val rows = root.optJSONArray("products") ?: error("Recommendation products are missing.")
        require(rows.length() <= MART_RECOMMENDATIONS_LIMIT) { "Too many recommended products." }
        val products = buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val id = item.optString("id")
                val name = item.optString("name").trim()
                val price = item.optJSONObject("price") ?: continue
                val amount = runCatching { readNonNegativeMinorUnits(price, "amountMinor") }.getOrNull() ?: continue
                val currency = runCatching { readCurrency(price) }.getOrNull() ?: continue
                if (!isSafeMartIdentifier(id) || name.isEmpty()) continue
                add(
                    MartProduct(
                        id = id,
                        name = name,
                        amountMinor = amount,
                        currency = currency,
                        imageUrl = safeMediaUrl(item.optNullableString("imageUrl")),
                        stock = item.optInt("stock").coerceAtLeast(0),
                    ),
                )
            }
        }
        return MartRecommendations(products = products, source = source)
    }

    fun parseProductDetail(body: String, expectedId: String): MartProductDetail {
        require(isSafeMartIdentifier(expectedId))
        val root = JSONObject(body)
        val id = root.optString("id")
        require(id == expectedId) { "Product response did not match the requested product." }
        val title = root.optString("title").trim().ifEmpty { root.optString("name").trim() }
        require(title.isNotEmpty()) { "Product title is missing." }
        val price = root.optJSONObject("price") ?: error("Product price is missing.")
        val amountMinor = readNonNegativeMinorUnits(price, "amountMinor")
        val currency = readCurrency(price)
        val storeJson = root.optJSONObject("store") ?: error("Product store is missing.")
        val storeId = storeJson.optString("id")
        val storeName = storeJson.optString("name").trim()
        require(isSafeMartIdentifier(storeId) && storeName.isNotEmpty()) { "Product store is invalid." }
        val imagesJson = root.optJSONArray("images") ?: JSONArray()
        val images = buildList {
            for (index in 0 until imagesJson.length()) {
                safeMediaUrl(imagesJson.optString(index).takeUnless { it.isBlank() || it == "null" })?.let(::add)
            }
        }
        val variantsJson = root.optJSONArray("variants") ?: JSONArray()
        val brandJson = root.optJSONObject("brand")
        val brand = brandJson?.let {
            val brandId = it.optString("brandId")
            val brandName = it.optString("name").trim()
            if (isSafeMartIdentifier(brandId) && brandName.isNotEmpty()) MartBrandTag(brandId, brandName) else null
        }
        val variants = buildList {
            for (index in 0 until variantsJson.length()) {
                val variant = variantsJson.optJSONObject(index) ?: continue
                val variantId = variant.optString("id")
                val variantTitle = variant.optString("title").trim()
                val variantPrice = variant.optJSONObject("price") ?: continue
                if (!isSafeMartIdentifier(variantId) || variantTitle.isEmpty()) continue
                val variantMinor = runCatching { readNonNegativeMinorUnits(variantPrice, "amountMinor") }.getOrNull() ?: continue
                val variantCurrency = runCatching { readCurrency(variantPrice) }.getOrNull() ?: continue
                if (variantCurrency != currency) continue
                val optionValuesJson = variant.optJSONObject("optionValues")
                val optionValues = buildMap {
                    optionValuesJson?.keys()?.forEach { key ->
                        optionValuesJson.optString(key).trim().takeIf(String::isNotEmpty)?.let { put(key, it) }
                    }
                }
                add(
                    MartProductVariant(
                        id = variantId,
                        title = variantTitle,
                        priceMinor = variantMinor,
                        currency = variantCurrency,
                        inStock = variant.optBoolean("inStock"),
                        size = variant.optString("size").trim(),
                        color = variant.optString("color").trim(),
                        optionValues = optionValues,
                    ),
                )
            }
        }
        return MartProductDetail(
            id = id,
            title = title,
            amountMinor = amountMinor,
            currency = currency,
            stock = root.optInt("stock").coerceAtLeast(0),
            images = images,
            rating = root.optDouble("rating").takeIf { it.isFinite() && it >= 0 } ?: 0.0,
            promo = root.optNullableString("promo"),
            sizes = root.readStringList("sizes"),
            colors = root.readStringList("colors"),
            shippingInfo = root.optString("shippingInfo").trim(),
            description = root.optString("description").trim(),
            store = MartStoreSummary(
                id = storeId,
                name = storeName,
                logoUrl = safeMediaUrl(storeJson.optNullableString("logoUrl")),
                rating = storeJson.optDouble("rating").takeIf { it.isFinite() && it >= 0 } ?: 0.0,
                ratingCount = storeJson.optInt("ratingCount").coerceAtLeast(0),
                reviewCount = storeJson.optInt("reviewCount").coerceAtLeast(0),
                isFollowing = storeJson.optBoolean("isFollowing"),
            ),
            variants = variants,
            brand = brand,
        )
    }
}

private fun readNonNegativeMinorUnits(value: JSONObject, key: String): Long {
    val raw = value.opt(key)
    require(raw is Number) { "Product money must use integer minor units." }
    val number = raw.toLong()
    require(raw.toDouble() == number.toDouble() && number >= 0) { "Product money must use non-negative integer minor units." }
    return number
}

private fun readCurrency(value: JSONObject): String {
    val code = value.optString("currency")
    require(code.matches(Regex("[A-Z]{3}")) && runCatching { java.util.Currency.getInstance(code) }.isSuccess) {
        "Product currency is invalid."
    }
    return code
}

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeUnless { it.isBlank() || it == "null" }

private fun JSONObject.readStringList(key: String): List<String> {
    val rows = optJSONArray(key) ?: return emptyList()
    return buildList {
        for (index in 0 until rows.length()) rows.optString(index).trim().takeIf(String::isNotEmpty)?.let(::add)
    }
}
