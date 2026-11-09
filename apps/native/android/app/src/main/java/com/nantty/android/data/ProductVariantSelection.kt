package com.nantty.android.data

internal data class ProductOptionChoice(val label: String, val value: String)

internal data class ProductOptionGroup(
    val key: String,
    val label: String,
    val choices: List<ProductOptionChoice>,
)

internal const val PRODUCT_VARIANT_ID_OPTION_KEY = "__nantty_variant_id"

/**
 * Builds the independent option controls used by React Native from the product's server-owned
 * variants. Size and color retain their dedicated fields; seller-defined options use optionValues.
 */
internal fun productOptionGroups(detail: MartProductDetail): List<ProductOptionGroup> = buildList {
    detail.sizes.distinctNonBlank().takeIf(List<String>::isNotEmpty)?.let { values ->
        add(ProductOptionGroup("size", "Size", values.map { ProductOptionChoice(it, it) }))
    }
    detail.colors.distinctNonBlank().takeIf(List<String>::isNotEmpty)?.let { values ->
        add(ProductOptionGroup("color", "Color", values.map { ProductOptionChoice(it, it) }))
    }

    val optionNames = detail.variants
        .flatMap { it.optionValues.keys }
        .distinct()
        .filterNot { name ->
            name.equals("size", ignoreCase = true) || name.equals("color", ignoreCase = true) ||
                name == PRODUCT_VARIANT_ID_OPTION_KEY
        }
        .sortedWith(String.CASE_INSENSITIVE_ORDER)
    optionNames.forEach { name ->
        val values = detail.variants.mapNotNull { it.optionValues[name]?.trim()?.takeIf(String::isNotEmpty) }.distinct()
        if (values.isNotEmpty()) add(ProductOptionGroup(name, name, values.map { ProductOptionChoice(it, it) }))
    }

    // Older catalogue responses can contain variants without their option dimensions. Keep those
    // products selectable by their server-issued variant IDs instead of guessing from a title.
    if (isEmpty() && detail.variants.size > 1) {
        add(
            ProductOptionGroup(
                PRODUCT_VARIANT_ID_OPTION_KEY,
                "Option",
                detail.variants.mapIndexed { index, variant ->
                    ProductOptionChoice(variant.title.ifBlank { "Option ${index + 1}" }, variant.id)
                },
            ),
        )
    }
}

internal fun resolveProductVariant(
    detail: MartProductDetail,
    groups: List<ProductOptionGroup>,
    selections: Map<String, String>,
): MartProductVariant? {
    if (detail.variants.isEmpty()) return null
    if (groups.isEmpty()) return detail.variants.singleOrNull()
    if (groups.any { it.key !in selections }) return null
    val matches = detail.variants.filter { variant -> variant.matchesProductOptions(selections) }
    return matches.singleOrNull()
}

internal fun productOptionHasStock(
    variants: List<MartProductVariant>,
    selections: Map<String, String>,
    groupKey: String,
    value: String,
): Boolean {
    val proposed = selections + (groupKey to value)
    return variants.any { it.inStock && it.matchesProductOptions(proposed) }
}

private fun MartProductVariant.matchesProductOptions(selections: Map<String, String>): Boolean =
    selections.all { (key, value) ->
        when (key) {
            "size" -> size.equals(value, ignoreCase = true)
            "color" -> color.equals(value, ignoreCase = true)
            PRODUCT_VARIANT_ID_OPTION_KEY -> id == value
            else -> optionValues[key]?.equals(value, ignoreCase = true) == true
        }
    }

private fun List<String>.distinctNonBlank(): List<String> = map(String::trim).filter(String::isNotEmpty).distinct()
