package interfaces

import (
	"context"
	"errors"
	"time"
)

var (
	ErrInsufficientCoins           = errors.New("insufficient coins")
	ErrCannotGiftSelf              = errors.New("cannot gift self")
	ErrRecipientCannotReceiveGifts = errors.New("recipient cannot receive gifts")
	ErrIdempotencyKeyReused        = errors.New("idempotency key reused with a different request")
	ErrBattleSettledDifferently    = errors.New("battle already settled differently")
	ErrMoneyRequestInvalid         = errors.New("money request invalid")
)

type ChargeGiftRequest struct {
	SenderUserId   string
	ReceiverUserId string
	HostUserId     string
	LiveId         string
	GiftId         string
	Quantity       int
	UnitPriceCoins int64
	BattleId       string
	IdempotencyKey string
	ComboId        string
}

type ChargedGift struct {
	GiftTransactionId   string
	CreditedUserId      string
	TotalCoins          int64
	PlatformFeeCoins    int64
	CreatorAmountCoins  int64
	Status              string
	LedgerTransactionId string
	SenderCoinBalance   int64
	CreatedAt           time.Time
	Replayed            bool
}

type BattleParticipantOutcome string

const (
	OutcomeActive          BattleParticipantOutcome = "active"
	OutcomeForfeited       BattleParticipantOutcome = "forfeited"
	OutcomeRemovedByHost   BattleParticipantOutcome = "removedByHost"
	SettlementRuleKeepOwn                           = "keepOwn"
	SettlementRuleWinnerTA                          = "winnerTakesAll"
)

type SettlementParticipant struct {
	UserId  string
	Outcome BattleParticipantOutcome
}

type SettleBattleRequest struct {
	BattleId     string
	LiveId       string
	HostUserId   string
	Rule         string
	WinnerUserId string
	Participants []SettlementParticipant
}

type CoinTransfer struct {
	FromUserId string `json:"fromUserId"`
	ToUserId   string `json:"toUserId"`
	Coins      int64  `json:"coins"`
}

type ParticipantPayout struct {
	UserId         string `json:"userId"`
	HoldingCoins   int64  `json:"holdingCoins"`
	CreditedUserId string `json:"creditedUserId"`
}

type BattleSettlement struct {
	BattleId            string              `json:"battleId"`
	RuleApplied         string              `json:"ruleApplied"`
	WinnerUserId        string              `json:"winnerUserId"`
	Payouts             []ParticipantPayout `json:"payouts"`
	Transfers           []CoinTransfer      `json:"transfers"`
	LedgerTransactionId string              `json:"ledgerTransactionId"`
	SettledAt           time.Time           `json:"settledAt"`
}

type BattleGiftTotal struct {
	ReceiverUserId string
	GrossCoins     int64
	GiftCount      int64
}

type MoneyGateway interface {
	GetBattleGiftTotals(ctx context.Context, battleId string) ([]BattleGiftTotal, error)
	ChargeGiftAndCreditCreator(ctx context.Context, request ChargeGiftRequest) (ChargedGift, error)
	SettleBattle(ctx context.Context, request SettleBattleRequest) (BattleSettlement, error)
	GetCoinBalance(ctx context.Context, userId string) (int64, error)
}
