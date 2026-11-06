package integrations

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/interfaces"
)

type InMemoryMoneyGateway struct {
	mutex                   sync.Mutex
	Balances                map[string]int64
	DefaultBalance          int64
	CreatorShareBps         int64
	Charges                 map[string]interfaces.ChargedGift
	chargeRequests          map[string]interfaces.ChargeGiftRequest
	battleContributions     map[string]interfaces.BattleCoinContributionReceipt
	battleContributionReqs  map[string]interfaces.BattleCoinContributionRequest
	Settlements             map[string]interfaces.BattleSettlement
	SettleCallCount         map[string]int
	holdings                map[string]map[string]int64
	GiftEarnedCoins         map[string]int64
	battleGross             map[string]map[string]interfaces.BattleGiftTotal
	FailSettlementOn        bool
	FailAfterSettlementOnce bool
	SettlementHook          func()
}

func NewInMemoryMoneyGateway() *InMemoryMoneyGateway {
	return &InMemoryMoneyGateway{
		Balances: map[string]int64{}, DefaultBalance: 100_000, CreatorShareBps: 7000,
		Charges: map[string]interfaces.ChargedGift{}, chargeRequests: map[string]interfaces.ChargeGiftRequest{},
		battleContributions: map[string]interfaces.BattleCoinContributionReceipt{}, battleContributionReqs: map[string]interfaces.BattleCoinContributionRequest{},
		Settlements: map[string]interfaces.BattleSettlement{}, SettleCallCount: map[string]int{},
		holdings: map[string]map[string]int64{}, GiftEarnedCoins: map[string]int64{}, battleGross: map[string]map[string]interfaces.BattleGiftTotal{},
	}
}

func (gateway *InMemoryMoneyGateway) balanceLocked(userId string) int64 {
	if balance, known := gateway.Balances[userId]; known {
		return balance
	}
	return gateway.DefaultBalance
}

func (gateway *InMemoryMoneyGateway) ChargeGiftAndCreditCreator(_ context.Context, request interfaces.ChargeGiftRequest) (interfaces.ChargedGift, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	scopedKey := request.SenderUserId + ":" + request.IdempotencyKey
	if earlier, replayed := gateway.Charges[scopedKey]; replayed {
		if gateway.chargeRequests[scopedKey] != request {
			return interfaces.ChargedGift{}, interfaces.ErrIdempotencyKeyReused
		}
		earlier.Replayed = true
		return earlier, nil
	}
	if request.SenderUserId == request.ReceiverUserId {
		return interfaces.ChargedGift{}, interfaces.ErrCannotGiftSelf
	}
	total := request.UnitPriceCoins * int64(request.Quantity)
	if gateway.balanceLocked(request.SenderUserId) < total {
		return interfaces.ChargedGift{}, interfaces.ErrInsufficientCoins
	}
	gateway.Balances[request.SenderUserId] = gateway.balanceLocked(request.SenderUserId) - total
	creator := total * gateway.CreatorShareBps / 10_000
	if request.BattleId != "" {
		if gateway.holdings[request.BattleId] == nil {
			gateway.holdings[request.BattleId] = map[string]int64{}
		}
		gateway.holdings[request.BattleId][request.ReceiverUserId] += creator
		if gateway.battleGross[request.BattleId] == nil {
			gateway.battleGross[request.BattleId] = map[string]interfaces.BattleGiftTotal{}
		}
		total := gateway.battleGross[request.BattleId][request.ReceiverUserId]
		gateway.battleGross[request.BattleId][request.ReceiverUserId] = interfaces.BattleGiftTotal{ReceiverUserId: request.ReceiverUserId, GrossCoins: total.GrossCoins + gateway.chargeTotal(request), GiftCount: total.GiftCount + 1}
	} else {
		gateway.GiftEarnedCoins[request.ReceiverUserId] += creator
	}
	charged := interfaces.ChargedGift{
		GiftTransactionId: uuid.NewString(), CreditedUserId: request.ReceiverUserId, TotalCoins: total, PlatformFeeCoins: total - creator,
		CreatorAmountCoins: creator, Status: "committed", LedgerTransactionId: uuid.NewString(),
		SenderCoinBalance: gateway.Balances[request.SenderUserId], CreatedAt: time.Now(),
	}
	gateway.Charges[scopedKey] = charged
	gateway.chargeRequests[scopedKey] = request
	return charged, nil
}

func (gateway *InMemoryMoneyGateway) GetCoinBalance(_ context.Context, userId string) (int64, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	return gateway.balanceLocked(userId), nil
}

func (gateway *InMemoryMoneyGateway) ChargeSpaceCoinGift(_ context.Context, _ interfaces.ChargeSpaceCoinGiftRequest) (interfaces.SpaceCoinGiftReceipt, error) {
	return interfaces.SpaceCoinGiftReceipt{}, interfaces.ErrSpaceGiftGatewayUnavailable
}

func (gateway *InMemoryMoneyGateway) DonateSpaceCoins(_ context.Context, _ interfaces.DonateSpaceCoinsRequest) (interfaces.SpaceCoinDonationReceipt, error) {
	return interfaces.SpaceCoinDonationReceipt{}, interfaces.ErrSpaceGiftGatewayUnavailable
}

func (gateway *InMemoryMoneyGateway) ContributeBattleCoins(_ context.Context, request interfaces.BattleCoinContributionRequest) (interfaces.BattleCoinContributionReceipt, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	key := request.SenderUserId + ":" + request.IdempotencyKey
	if receipt, exists := gateway.battleContributions[key]; exists {
		if gateway.battleContributionReqs[key] != request {
			return interfaces.BattleCoinContributionReceipt{}, interfaces.ErrIdempotencyKeyReused
		}
		receipt.Replayed = true
		return receipt, nil
	}
	if request.SenderUserId == request.RecipientUserId {
		return interfaces.BattleCoinContributionReceipt{}, interfaces.ErrCannotGiftSelf
	}
	if request.Coins <= 0 {
		return interfaces.BattleCoinContributionReceipt{}, interfaces.ErrMoneyRequestInvalid
	}
	if gateway.balanceLocked(request.SenderUserId) < request.Coins {
		return interfaces.BattleCoinContributionReceipt{}, interfaces.ErrInsufficientCoins
	}
	fee := request.Coins / 50 // 2% policy in the deterministic in-memory gateway.
	holding := request.Coins - fee
	gateway.Balances[request.SenderUserId] = gateway.balanceLocked(request.SenderUserId) - request.Coins
	if gateway.holdings[request.BattleId] == nil {
		gateway.holdings[request.BattleId] = map[string]int64{}
	}
	gateway.holdings[request.BattleId][request.RecipientUserId] += holding
	receipt := interfaces.BattleCoinContributionReceipt{ContributionId: uuid.NewString(), LedgerTransactionId: uuid.NewString(),
		SenderUserId: request.SenderUserId, RecipientUserId: request.RecipientUserId, BattleId: request.BattleId,
		TotalCoins: request.Coins, PlatformFeeCoins: fee, HoldingCoins: holding, SenderCoinBalance: gateway.Balances[request.SenderUserId]}
	gateway.battleContributions[key], gateway.battleContributionReqs[key] = receipt, request
	return receipt, nil
}

func (gateway *InMemoryMoneyGateway) chargeTotal(request interfaces.ChargeGiftRequest) int64 {
	return request.UnitPriceCoins * int64(request.Quantity)
}

func (gateway *InMemoryMoneyGateway) GetBattleGiftTotals(_ context.Context, battleId string) ([]interfaces.BattleGiftTotal, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	totals := []interfaces.BattleGiftTotal{}
	for _, total := range gateway.battleGross[battleId] {
		totals = append(totals, total)
	}
	return totals, nil
}
