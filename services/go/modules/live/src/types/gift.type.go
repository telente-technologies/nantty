package types

import "github.com/google/uuid"

type LiveGiftView struct {
	Id                string         `json:"id"`
	Name              string         `json:"name"`
	Description       *string        `json:"description,omitempty"`
	Tier              string         `json:"tier"`
	PriceCoins        int64          `json:"priceCoins"`
	AnimationEngine   string         `json:"animationEngine"`
	AnimationAssetKey string         `json:"animationAssetKey"`
	PreviewAssetKey   string         `json:"previewAssetKey"`
	DurationMs        int            `json:"durationMs"`
	DisplayLevel      string         `json:"displayLevel"`
	Sound             *string        `json:"sound"`
	Haptic            *string        `json:"haptic"`
	Comboable         bool           `json:"comboable"`
	IsActive          bool           `json:"isActive"`
	SortOrder         int            `json:"sortOrder"`
	Metadata          map[string]any `json:"metadata,omitempty"`
}

type GiftInput struct {
	Id                string
	Name              *string
	Description       *string
	Tier              *string
	PriceCoins        *int64
	AnimationEngine   *string
	AnimationAssetKey *string
	PreviewAssetKey   *string
	DurationMs        *int
	DisplayLevel      *string
	Sound             *string
	Haptic            *string
	Comboable         *bool
	IsActive          *bool
	SortOrder         *int
	Metadata          map[string]any
}

type GiftGoalView struct {
	Id            string  `json:"id"`
	LiveId        string  `json:"liveId"`
	CreatorId     string  `json:"creatorId"`
	Title         string  `json:"title"`
	TargetCoins   int64   `json:"targetCoins"`
	GiftId        *string `json:"giftId"`
	ProgressCoins int64   `json:"progressCoins"`
	Status        string  `json:"status"`
	CompletedAt   *string `json:"completedAt"`
}

type GiftGoalInput struct {
	Title         *string
	TargetCoins   *int64
	GiftId        *string
	GiftIdPresent bool
}

type LeaderboardUser struct {
	Id        string  `json:"id"`
	Name      string  `json:"name"`
	Username  string  `json:"username"`
	AvatarUrl *string `json:"avatarUrl"`
}

type LeaderboardEntryView struct {
	Rank   int             `json:"rank"`
	User   LeaderboardUser `json:"user"`
	Coins  int64           `json:"coins"`
	Points int64           `json:"points"`
}

type LeaderboardView struct {
	Data         []LeaderboardEntryView `json:"data"`
	NextCursor   *string                `json:"nextCursor"`
	ViewerRank   *int                   `json:"viewerRank"`
	ViewerPoints int64                  `json:"viewerPoints"`
}

type GiftReceipt struct {
	GiftTransactionId string  `json:"giftTransactionId"`
	GiftId            string  `json:"giftId"`
	Quantity          int     `json:"quantity"`
	TotalCoins        int64   `json:"totalCoins"`
	ReceiverUserId    string  `json:"receiverUserId"`
	ComboId           string  `json:"comboId"`
	ComboCount        int     `json:"comboCount"`
	CoinBalance       int64   `json:"coinBalance"`
	BattleId          *string `json:"battleId"`
	CreatedAt         string  `json:"createdAt"`
}

type SendGiftInput struct {
	LiveId         uuid.UUID
	GiftId         string
	Quantity       int
	ReceiverUserId *uuid.UUID
	ComboId        string
	IdempotencyKey string
}

type MoneyView struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type StreamStatsView struct {
	LiveId            string                   `json:"liveId"`
	GiftCount         int64                    `json:"giftCount"`
	TotalCoins        int64                    `json:"totalCoins"`
	CreatorCoins      int64                    `json:"creatorCoins"`
	EstimatedEarnings *MoneyView               `json:"estimatedEarnings"`
	TopSupporters     []LeaderboardEntryView   `json:"topSupporters"`
	Battles           []StreamBattleResultView `json:"battles"`
	NewSubscribers    int                      `json:"newSubscribers"`
}

type StreamBattleResultView struct {
	Id           string `json:"id"`
	OpponentName string `json:"opponentName"`
	CoinsFor     int64  `json:"coinsFor"`
	CoinsAgainst int64  `json:"coinsAgainst"`
}
