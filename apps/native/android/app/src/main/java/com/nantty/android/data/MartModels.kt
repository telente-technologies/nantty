package com.nantty.android.data

data class MartCategory(val id: String, val name: String, val depth: Int)
data class MartProduct(val id: String, val name: String, val amountMinor: Long, val currency: String, val imageUrl: String?, val stock: Int)
data class MartStoreSummary(
    val id: String,
    val name: String,
    val logoUrl: String?,
    val rating: Double,
    val ratingCount: Int,
    val reviewCount: Int,
    val isFollowing: Boolean = false,
)
data class MartProductVariant(
    val id: String,
    val title: String,
    val priceMinor: Long,
    val currency: String,
    val inStock: Boolean,
    val size: String = "",
    val color: String = "",
    val optionValues: Map<String, String> = emptyMap(),
)
data class MartBrandTag(val id: String, val name: String)
data class MartProductDetail(
    val id: String,
    val title: String,
    val amountMinor: Long,
    val currency: String,
    val stock: Int,
    val images: List<String>,
    val rating: Double,
    val promo: String?,
    val sizes: List<String>,
    val colors: List<String>,
    val shippingInfo: String,
    val description: String,
    val store: MartStoreSummary,
    val variants: List<MartProductVariant>,
    val brand: MartBrandTag? = null,
)
data class MartPage(val products: List<MartProduct>, val nextCursor: String?)
data class MartRecommendations(val products: List<MartProduct>, val source: String)
data class MartHome(
    val categories: List<MartCategory>,
    val salesOfTheDayImageUrl: String? = null,
    val featuredBrandsImageUrl: String? = null,
    val newArrivalsImageUrl: String? = null,
)
sealed interface MartHighlightTarget {
    data class Product(val productId: String, val name: String) : MartHighlightTarget
    data class Collection(val collection: String, val name: String) : MartHighlightTarget
    data class Category(val categoryId: String, val name: String) : MartHighlightTarget
}
data class MartSponsoredPlacement(
    val campaignId: String,
    val label: String,
    val advertiserName: String,
    val impressionToken: String,
)
data class MartHighlight(
    val id: String,
    val kind: String,
    val title: String,
    val subtitle: String?,
    val imageUrl: String?,
    val target: MartHighlightTarget,
    val reasonLabel: String,
    val sponsored: MartSponsoredPlacement?,
)

sealed interface MartResult {
    data class Home(val value: MartHome) : MartResult
    data class Products(val value: MartPage) : MartResult
    data class Highlights(val value: List<MartHighlight>) : MartResult
    data class Failure(val message: String) : MartResult
}

sealed interface MartProductDetailResult {
    data class Success(val value: MartProductDetail) : MartProductDetailResult
    data class Failure(val message: String) : MartProductDetailResult
}

sealed interface MartRecommendationsResult {
    data class Success(val value: MartRecommendations) : MartRecommendationsResult
    data class Failure(val message: String) : MartRecommendationsResult
}
