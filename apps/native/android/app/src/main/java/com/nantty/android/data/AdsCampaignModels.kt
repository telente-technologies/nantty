package com.nantty.android.data

import org.json.JSONObject

internal data class AdsCampaignGoal(val id: String, val label: String)
internal data class AdsCampaignPaymentOption(val method: String, val available: Boolean, val reason: String?)
internal data class AdsCampaignOptions(
    val minimumDailyBudget: AdsWorkspaceMoney,
    val suggestedDailyBudgets: List<AdsWorkspaceMoney>,
    val durationDays: List<Int>,
    val interests: List<String>,
    val paymentOptions: List<AdsCampaignPaymentOption>,
    val freeBoostEligible: Boolean,
    val freeBoostRemaining: Int,
    val freeBoostMaxTotal: AdsWorkspaceMoney?,
    val adBalanceSpendable: AdsWorkspaceMoney?,
    val maximumDurationDays: Int,
    val maximumScheduleDays: Int,
    val goalsByDestination: Map<String, List<String>>,
)

internal data class AdsCampaignDestination(val type: String, val targetId: String, val label: String)
internal data class AdsCampaignLocation(val code: String, val name: String, val type: String)
internal data class AdsCampaignTopic(val id: String, val name: String)
internal data class AdsCampaignDestinations(
    val profile: AdsCampaignDestination,
    val store: AdsCampaignDestination?,
    val posts: List<AdsCampaignDestination>,
    val products: List<AdsCampaignDestination>,
    val defaultCountryCode: String?,
)

internal data class AdsCampaignAudience(
    val mode: String = "automatic",
    val countryCode: String = "",
    val states: List<String> = emptyList(),
    val interests: List<String> = emptyList(),
    val ageMin: Int = 18,
    val ageMax: Int = 65,
    val gender: String = "all",
    val topicIds: List<String> = emptyList(),
)

internal data class AdsCampaignDraft(
    val destination: AdsCampaignDestination? = null,
    val goal: String? = null,
    val audience: AdsCampaignAudience = AdsCampaignAudience(),
    val budgetType: String = "daily",
    val dailyBudget: AdsWorkspaceMoney? = null,
    val totalBudget: AdsWorkspaceMoney? = null,
    val durationDays: Int? = null,
    val startAt: String? = null,
    val paymentMethod: String? = null,
)

internal data class AdsCampaignEstimate(
    val reachMin: Long,
    val reachMax: Long,
    val resultLabel: String,
    val totalCost: AdsWorkspaceMoney,
)

internal data class AdsCampaignResubmitSource(
    val destination: AdsCampaignDestination,
    val goal: String,
    val audience: AdsCampaignAudience,
    val budgetType: String,
    val dailyBudget: AdsWorkspaceMoney,
    val totalBudget: AdsWorkspaceMoney?,
    val durationDays: Int,
    val rejectionReason: String?,
)

internal data class AdsCampaignCreated(val boostId: String, val checkoutUrl: String?)

internal sealed interface AdsCampaignResult<out T> {
    data class Success<T>(val value: T) : AdsCampaignResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : AdsCampaignResult<Nothing>
}

internal fun interface AdsCampaignTransport {
    fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): JSONObject
}
