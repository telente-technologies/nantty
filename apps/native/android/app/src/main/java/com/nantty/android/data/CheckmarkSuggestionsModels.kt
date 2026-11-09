package com.nantty.android.data

/** Server-authored checkmark suggestion. Rules and eligibility are intentionally not inferred on device. */
data class CheckmarkSuggestion(
    val color: String,
    val eligible: Boolean,
    val dismissed: Boolean,
    val headline: String,
    val detail: String,
    val rules: List<CheckmarkSuggestionRule>,
)

data class CheckmarkSuggestionRule(
    val label: String,
    val met: Boolean,
)

data class CheckmarkVerificationCurrent(
    val status: String,
    val type: String,
    val color: String,
    val tier: String,
    val badgeVisible: Boolean,
    val graceEndsAt: String?,
)

data class CheckmarkVerificationApplication(
    val id: String,
    val color: String,
    val status: String,
    val submittedAt: String,
    val rejectionReason: String?,
)

data class CheckmarkVerificationSubscription(
    val planId: String,
    val status: String,
    val renewsAt: String?,
    val cancelAtPeriodEnd: Boolean,
)

data class CheckmarkVerificationPerk(
    val title: String,
    val description: String,
)

data class CheckmarkVerificationPlan(
    val id: String,
    val planCode: String,
    val name: String,
    val color: String,
    val tier: String,
    val price: CheckmarkDiscountMoney,
    val interval: String,
    val channel: String,
    val storeProductId: String?,
    val perks: List<CheckmarkVerificationPerk>,
)

data class CheckmarkMyVerification(
    val current: CheckmarkVerificationCurrent?,
    val subscription: CheckmarkVerificationSubscription?,
    val application: CheckmarkVerificationApplication?,
    val handleReserved: Boolean,
    val reverificationDueAt: String?,
)

data class CheckmarkOfferPlan(
    val planCode: String,
    val planLabel: String,
)

data class CheckmarkDiscountMoney(
    val amountMinor: Long,
    val currency: String,
)

data class CheckmarkOfferDiscountTerms(
    val kind: String,
    val percentOff: Long?,
    val amountOff: CheckmarkDiscountMoney?,
)

data class CheckmarkOfferDiscount(
    val linkId: String,
    val token: String,
    val plans: List<CheckmarkOfferPlan>,
    val discount: CheckmarkOfferDiscountTerms,
    val durationCycles: Int,
    val expiresAt: String?,
    val sentAt: String,
)

data class CheckmarkBundleDiscount(
    val percentOff: Long,
)

data class CheckmarkVerificationDiscounts(
    val offers: List<CheckmarkOfferDiscount>,
    val yearlyPercentOff: Long,
    val bundle: CheckmarkBundleDiscount?,
)

sealed interface CheckmarkSuggestionsResult<out T> {
    data class Success<T>(val value: T) : CheckmarkSuggestionsResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CheckmarkSuggestionsResult<Nothing>
}
