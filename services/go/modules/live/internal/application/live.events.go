package application

import "time"

const (
	eventLiveStarted             = "live.started"
	eventLiveEnded               = "live.ended"
	eventLiveTopSupporter        = "live.topSupporterSelected"
	eventLiveViewerCountChanged  = "live.viewerCountChanged"
	eventGiftSent                = "gift.sent"
	eventGoalProgressed          = "goal.progressed"
	eventGoalCompleted           = "goal.completed"
	eventLeaderboardUpdated      = "leaderboard.updated"
	eventGuestInvited            = "guest.invited"
	eventGuestJoined             = "guest.joined"
	eventGuestLeft               = "guest.left"
	eventGuestRemoved            = "guest.removed"
	eventGuestMuted              = "guest.muted"
	eventGuestReconnecting       = "guest.reconnecting"
	eventStageUpdated            = "stage.updated"
	eventBattleCreated           = "battle.created"
	eventBattleStarted           = "battle.started"
	eventBattleScoreUpdated      = "battle.scoreUpdated"
	eventBattleEnded             = "battle.ended"
	eventBattleWinnerCelebrated  = "battle.winnerCelebrated"
	eventBattleSettled           = "battle.settled"
	eventBattleCancelled         = "battle.cancelled"
	winnerCelebrationAnimationId = "battle-winner-crown-v1"
)

type LiveStartedEventData struct {
	LiveId   string `json:"liveId"`
	HostId   string `json:"hostId"`
	Title    string `json:"title"`
	Category string `json:"category"`
}

type LiveEndedEventData struct {
	LiveId      string    `json:"liveId"`
	HostId      string    `json:"hostId"`
	EndedAt     time.Time `json:"endedAt"`
	PeakViewers int       `json:"peakViewers"`
	GiftCount   int64     `json:"giftCount"`
	TotalCoins  int64     `json:"totalCoins"`
}

type LiveTopSupporterEventData struct {
	LiveId string      `json:"liveId"`
	User   UserSummary `json:"user"`
	Coins  int64       `json:"coins"`
	Points int64       `json:"points"`
}

type LiveViewerCountEventData struct {
	LiveId  string `json:"liveId"`
	Viewers int    `json:"viewers"`
}

type GiftSender struct {
	Id        string  `json:"id"`
	Name      string  `json:"name"`
	AvatarUrl *string `json:"avatarUrl"`
}

type GiftSentEventData struct {
	LiveId            string     `json:"liveId"`
	GiftTransactionId string     `json:"giftTransactionId"`
	GiftId            string     `json:"giftId"`
	AnimationAssetKey string     `json:"animationAssetKey"`
	DisplayLevel      string     `json:"displayLevel"`
	Quantity          int        `json:"quantity"`
	TotalCoins        int64      `json:"totalCoins"`
	Sender            GiftSender `json:"sender"`
	ReceiverUserId    string     `json:"receiverUserId"`
	ComboId           string     `json:"comboId"`
	ComboCount        int        `json:"comboCount"`
	BattleId          *string    `json:"battleId,omitempty"`
}

type GoalContributor struct {
	UserId string `json:"userId"`
	Coins  int64  `json:"coins"`
}

type GoalEventData struct {
	LiveId          string            `json:"liveId"`
	GoalId          string            `json:"goalId"`
	Title           string            `json:"title"`
	TargetCoins     int64             `json:"targetCoins"`
	ProgressCoins   int64             `json:"progressCoins"`
	TopContributors []GoalContributor `json:"topContributors"`
	CompletedAt     *time.Time        `json:"completedAt,omitempty"`
}

type LeaderboardEventEntry struct {
	UserId string `json:"userId"`
	Coins  int64  `json:"coins"`
	Points int64  `json:"points"`
}

type LeaderboardEventData struct {
	LiveId string                  `json:"liveId"`
	Scope  string                  `json:"scope"`
	Top    []LeaderboardEventEntry `json:"top"`
}

type GuestInvitedEventData struct {
	LiveId    string      `json:"liveId"`
	UserId    string      `json:"userId"`
	SlotId    string      `json:"slotId"`
	Live      InvitedLive `json:"live"`
	ExpiresAt string      `json:"expiresAt"`
}

type InvitedLive struct {
	Id    string      `json:"id"`
	Title string      `json:"title"`
	Host  UserSummary `json:"host"`
}

type GuestChangedEventData struct {
	LiveId     string `json:"liveId"`
	SlotId     string `json:"slotId"`
	UserId     string `json:"userId"`
	State      string `json:"state"`
	AudioMuted bool   `json:"audioMuted"`
	VideoMuted bool   `json:"videoMuted"`
	Reason     string `json:"reason,omitempty"`
}
