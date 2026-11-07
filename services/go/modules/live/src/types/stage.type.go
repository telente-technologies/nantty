package types

import "github.com/google/uuid"

type CreateBattleInput struct {
	ParticipantUserIds []uuid.UUID
	DurationSeconds    int
	WinnerTakesAll     bool
	IdempotencyKey     string
}

type MuteGuestInput struct {
	Audio *bool
	Video *bool
}

type StageStreamer struct {
	SlotId                 string      `json:"slotId"`
	User                   UserSummary `json:"user"`
	Role                   string      `json:"role"`
	StageRole              string      `json:"stageRole"`
	Title                  string      `json:"title,omitempty"`
	State                  string      `json:"state"`
	AudioMuted             bool        `json:"audioMuted"`
	VideoMuted             bool        `json:"videoMuted"`
	GiftEligible           bool        `json:"giftEligible"`
	IsCreatorProgramMember bool        `json:"isCreatorProgramMember"`
	Position               int         `json:"position"`
}

type GuestSlotView struct {
	Id               string      `json:"id"`
	LiveId           string      `json:"liveId"`
	User             UserSummary `json:"user"`
	StageRole        string      `json:"stageRole"`
	Title            string      `json:"title,omitempty"`
	State            string      `json:"state"`
	InvitedAt        string      `json:"invitedAt"`
	ExpiresAt        string      `json:"expiresAt"`
	JoinedAt         *string     `json:"joinedAt,omitempty"`
	LeftAt           *string     `json:"leftAt,omitempty"`
	AudioMutedByHost bool        `json:"audioMutedByHost"`
	VideoMutedByHost bool        `json:"videoMutedByHost"`
	Position         int         `json:"position"`
}

type JoinRequestView struct {
	Id          string      `json:"id"`
	User        UserSummary `json:"user"`
	State       string      `json:"state"`
	RequestedAt string      `json:"requestedAt"`
}

type BattleGifterView struct {
	UserId string      `json:"userId"`
	User   UserSummary `json:"user"`
	Coins  int64       `json:"coins"`
}

type BattleParticipantView struct {
	UserId     string             `json:"userId"`
	User       UserSummary        `json:"user"`
	Score      int64              `json:"score"`
	Rank       int                `json:"rank"`
	State      string             `json:"state"`
	TopGifters []BattleGifterView `json:"topGifters"`
}

type BattleTransferView struct {
	FromUserId string `json:"fromUserId"`
	ToUserId   string `json:"toUserId"`
	Coins      int64  `json:"coins"`
}

type BattlePayoutView struct {
	UserId       string `json:"userId"`
	Score        int64  `json:"score"`
	EarnedCoins  int64  `json:"earnedCoins"`
	PaidToUserId string `json:"paidToUserId"`
}

type BattleView struct {
	Id                 string                  `json:"id"`
	LiveId             string                  `json:"liveId"`
	State              string                  `json:"state"`
	WinnerTakesAll     bool                    `json:"winnerTakesAll"`
	DurationSeconds    int                     `json:"durationSeconds"`
	CountdownStartedAt string                  `json:"countdownStartedAt"`
	StartsAt           string                  `json:"startsAt"`
	EndsAt             string                  `json:"endsAt"`
	SettledAt          *string                 `json:"settledAt"`
	CelebrationEndsAt  string                  `json:"celebrationEndsAt"`
	Participants       []BattleParticipantView `json:"participants"`
	WinnerUserIds      []string                `json:"winnerUserIds"`
	IsTie              bool                    `json:"isTie"`
	EndReason          *string                 `json:"endReason"`
	MvpGifter          *BattleGifterView       `json:"mvpGifter"`
	Transfers          []BattleTransferView    `json:"transfers"`
	Payouts            []BattlePayoutView      `json:"payouts"`
}

type ProposalConsentView struct {
	UserId string `json:"userId"`
	State  string `json:"state"`
}

type BattleProposalView struct {
	Id                string                `json:"id"`
	WinnerTakesAll    bool                  `json:"winnerTakesAll"`
	DurationSeconds   int                   `json:"durationSeconds"`
	Participants      []UserSummary         `json:"participants"`
	Consents          []ProposalConsentView `json:"consents"`
	ExpiresAt         string                `json:"expiresAt"`
	NeedsHostDecision bool                  `json:"needsHostDecision"`
}

type BattleGiftEventView struct {
	Id              string      `json:"id"`
	Sender          UserSummary `json:"sender"`
	RecipientUserId string      `json:"recipientUserId"`
	GiftEmoji       string      `json:"giftEmoji"`
	Coins           int64       `json:"coins"`
}

type LiveStageView struct {
	LiveId            string                `json:"liveId"`
	Layout            string                `json:"layout"`
	Phase             string                `json:"phase"`
	ServerNow         string                `json:"serverNow"`
	MyRole            string                `json:"myRole"`
	Streamers         []StageStreamer       `json:"streamers"`
	Invitations       []GuestSlotView       `json:"invitations"`
	JoinRequests      []JoinRequestView     `json:"joinRequests"`
	InvitationForMe   *GuestSlotView        `json:"invitationForMe"`
	MyJoinRequest     *JoinRequestView      `json:"myJoinRequest"`
	BattleProposal    *BattleProposalView   `json:"battleProposal"`
	ActiveBattle      *BattleView           `json:"activeBattle"`
	RecentBattleGifts []BattleGiftEventView `json:"recentBattleGifts"`
	BattleHistory     []BattleView          `json:"battleHistory"`
}
