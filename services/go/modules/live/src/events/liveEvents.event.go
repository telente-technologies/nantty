package events

import (
	"time"

	"nantty/modules/live/src/types"
)

const (
	LiveStarted                  = "live.started"
	LiveEnded                    = "live.ended"
	LiveScheduled                = "live.scheduled"
	LiveScheduleCancelled        = "live.scheduleCancelled"
	LiveReminderDue              = "live.reminderDue"
	LiveTopSupporter             = "live.topSupporterSelected"
	LiveViewerCountChanged       = "live.viewerCountChanged"
	GiftSent                     = "gift.sent"
	GoalProgressed               = "goal.progressed"
	GoalCompleted                = "goal.completed"
	LeaderboardUpdated           = "leaderboard.updated"
	GuestInvited                 = "guest.invited"
	GuestJoined                  = "guest.joined"
	GuestLeft                    = "guest.left"
	GuestRemoved                 = "guest.removed"
	GuestMuted                   = "guest.muted"
	GuestReconnecting            = "guest.reconnecting"
	StageUpdated                 = "stage.updated"
	BattleCreated                = "battle.created"
	BattleStarted                = "battle.started"
	BattleScoreUpdated           = "battle.scoreUpdated"
	BattleEnded                  = "battle.ended"
	BattleWinnerCelebrated       = "battle.winnerCelebrated"
	BattleSettled                = "battle.settled"
	BattleCancelled              = "battle.cancelled"
	WinnerCelebrationAnimationId = "battle-winner-crown-v1"
)

type LiveStartedEventData struct {
	LiveId         string  `json:"liveId"`
	HostId         string  `json:"hostId"`
	Title          string  `json:"title"`
	Category       string  `json:"category"`
	Visibility     string  `json:"visibility"`
	NotifyAudience string  `json:"notifyAudience"`
	CoverUrl       *string `json:"coverUrl"`
	StartedAt      string  `json:"startedAt"`

	Host            types.UserSummary `json:"host"`
	HostName        string            `json:"hostName"`
	HostHandle      string            `json:"hostHandle"`
	IsShopping      bool              `json:"isShopping"`
	ViewerCount     int               `json:"viewerCount"`
	NotifyUserIds   []string          `json:"notifyUserIds"`
	NotifyTruncated bool              `json:"notifyTruncated"`
}

func NotifyAudienceForVisibility(visibility string) string {
	if visibility == "subscribers" {
		return "subscribers"
	}
	return "followers"
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
	LiveId string            `json:"liveId"`
	User   types.UserSummary `json:"user"`
	Coins  int64             `json:"coins"`
	Points int64             `json:"points"`
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
	Id    string            `json:"id"`
	Title string            `json:"title"`
	Host  types.UserSummary `json:"host"`
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

type LiveScheduledEventData struct {
	LiveId      string `json:"liveId"`
	HostId      string `json:"hostId"`
	Title       string `json:"title"`
	Category    string `json:"category"`
	ScheduledAt string `json:"scheduledAt"`
}

type LiveScheduleCancelledEventData struct {
	LiveId string `json:"liveId"`
	HostId string `json:"hostId"`
}

type LiveReminderDueEventData struct {
	LiveId          string            `json:"liveId"`
	HostId          string            `json:"hostId"`
	Title           string            `json:"title"`
	ScheduledAt     string            `json:"scheduledAt"`
	Host            types.UserSummary `json:"host"`
	HostName        string            `json:"hostName"`
	HostHandle      string            `json:"hostHandle"`
	NotifyUserIds   []string          `json:"notifyUserIds"`
	NotifyTruncated bool              `json:"notifyTruncated"`
}
