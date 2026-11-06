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
	ErrLiveCoinSupportDisabled     = errors.New("live coin support disabled")
	ErrLiveNotActive               = errors.New("live not active")
	ErrIdempotencyKeyReused        = errors.New("idempotency key reused with a different request")
	ErrBattleSettledDifferently    = errors.New("battle already settled differently")
	ErrMoneyRequestInvalid         = errors.New("money request invalid")
	ErrSpaceGiftUnavailable        = errors.New("space gift unavailable")
	ErrSpaceGiftsDisabled          = errors.New("space gifts disabled")
	ErrSpaceHostNotCreator         = errors.New("space host is not an approved creator")
	ErrSpaceGiftBlocked            = errors.New("space gift unavailable between these accounts")
	ErrSpaceGiftGatewayUnavailable = errors.New("space coin gifts are unavailable in this gateway")
	ErrInvalidDonationAmount       = errors.New("space coin donation amount is outside policy")
	ErrSpaceDonationUnavailable    = errors.New("space coin donation unavailable")
	ErrSpaceDonationsDisabled      = errors.New("space coin donations disabled")
	ErrSpaceDonationBlocked        = errors.New("space coin donation unavailable between these accounts")
	ErrBattleContributionAmount    = errors.New("battle contribution amount outside policy")
	ErrBattleNotActive             = errors.New("battle not active")
	ErrBattleParticipantInactive   = errors.New("battle participant inactive")
	ErrBattleRecipientIneligible   = errors.New("battle recipient ineligible")
)

type DonationAmountPolicyError struct {
	MinimumCoins int64
	MaximumCoins int64
}

type BattleContributionAmountPolicyError struct {
	MinimumCoins int64
	MaximumCoins int64
}

func (failure *BattleContributionAmountPolicyError) Error() string {
	return ErrBattleContributionAmount.Error()
}
func (failure *BattleContributionAmountPolicyError) Is(target error) bool {
	return target == ErrBattleContributionAmount
}

func (failure *DonationAmountPolicyError) Error() string { return ErrInvalidDonationAmount.Error() }
func (failure *DonationAmountPolicyError) Is(target error) bool {
	return target == ErrInvalidDonationAmount
}

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

// ChargeSpaceCoinGiftRequest deliberately contains no recipient or price: the
// money service resolves the Space host and active catalog price authoritatively.
type ChargeSpaceCoinGiftRequest struct {
	SenderUserId   string
	SpaceId        string
	GiftId         string
	Quantity       int
	IdempotencyKey string
}

type SpaceCoinGiftReceipt struct {
	GiftTransactionId   string
	LedgerTransactionId string
	SenderUserId        string
	HostUserId          string
	SpaceId             string
	GiftId              string
	Quantity            int
	UnitPriceCoins      int64
	TotalCoins          int64
	PlatformFeeCoins    int64
	CreatorAmountCoins  int64
	SenderCoinBalance   int64
	Replayed            bool
}

type DonateSpaceCoinsRequest struct {
	SenderUserId   string
	SpaceId        string
	Coins          int64
	IdempotencyKey string
}

type SpaceCoinDonationReceipt struct {
	DonationId          string
	LedgerTransactionId string
	SenderUserId        string
	HostUserId          string
	SpaceId             string
	TotalCoins          int64
	PlatformFeeCoins    int64
	CreatorAmountCoins  int64
	SenderCoinBalance   int64
	Replayed            bool
}

type BattleCoinContributionRequest struct {
	SenderUserId    string
	RecipientUserId string
	BattleId        string
	Coins           int64
	IdempotencyKey  string
}

type BattleCoinContributionReceipt struct {
	ContributionId      string
	LedgerTransactionId string
	SenderUserId        string
	RecipientUserId     string
	BattleId            string
	LiveId              string
	TotalCoins          int64
	PlatformFeeCoins    int64
	HoldingCoins        int64
	SenderCoinBalance   int64
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
	ChargeSpaceCoinGift(ctx context.Context, request ChargeSpaceCoinGiftRequest) (SpaceCoinGiftReceipt, error)
	DonateSpaceCoins(ctx context.Context, request DonateSpaceCoinsRequest) (SpaceCoinDonationReceipt, error)
	ContributeBattleCoins(ctx context.Context, request BattleCoinContributionRequest) (BattleCoinContributionReceipt, error)
	SettleBattle(ctx context.Context, request SettleBattleRequest) (BattleSettlement, error)
	GetCoinBalance(ctx context.Context, userId string) (int64, error)
}
