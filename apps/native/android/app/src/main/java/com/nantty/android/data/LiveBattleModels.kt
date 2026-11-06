package com.nantty.android.data

/** Updated stage snapshot returned after an active-battle coin contribution. */
data class LiveStageResponse(
    val liveId: String,
    val layout: String,
    val phase: String,
    val serverNow: String,
    val myRole: String,
    val activeBattle: LiveBattleSnapshot?,
)

data class LiveBattleSnapshot(
    val id: String,
    val state: String,
    val participants: List<LiveBattleParticipantSnapshot>,
)

data class LiveBattleParticipantSnapshot(
    val userId: String,
    val score: Long,
    val rank: Int,
    val state: String,
)

data class LiveBattleCoinContribution(
    val recipientUserId: String,
    val coins: Long,
)
