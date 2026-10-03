package memory

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ports"
)

type MoneyGateway struct {
	mutex            sync.Mutex
	Balances         map[string]int64
	DefaultBalance   int64
	CreatorShareBps  int64
	Charges          map[string]ports.ChargedGift
	chargeRequests   map[string]ports.ChargeGiftRequest
	Settlements      map[string]ports.BattleSettlement
	SettleCallCount  map[string]int
	holdings         map[string]map[string]int64
	GiftEarnedCoins  map[string]int64
	battleGross      map[string]map[string]ports.BattleGiftTotal
	FailSettlementOn bool
}

func NewMoneyGateway() *MoneyGateway {
	return &MoneyGateway{
		Balances: map[string]int64{}, DefaultBalance: 100_000, CreatorShareBps: 7000,
		Charges: map[string]ports.ChargedGift{}, chargeRequests: map[string]ports.ChargeGiftRequest{},
		Settlements: map[string]ports.BattleSettlement{}, SettleCallCount: map[string]int{},
		holdings: map[string]map[string]int64{}, GiftEarnedCoins: map[string]int64{}, battleGross: map[string]map[string]ports.BattleGiftTotal{},
	}
}

func (gateway *MoneyGateway) balanceLocked(userId string) int64 {
	if balance, known := gateway.Balances[userId]; known {
		return balance
	}
	return gateway.DefaultBalance
}

func (gateway *MoneyGateway) ChargeGiftAndCreditCreator(_ context.Context, request ports.ChargeGiftRequest) (ports.ChargedGift, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	scopedKey := request.SenderUserId + ":" + request.IdempotencyKey
	if earlier, replayed := gateway.Charges[scopedKey]; replayed {
		if gateway.chargeRequests[scopedKey] != request {
			return ports.ChargedGift{}, ports.ErrIdempotencyKeyReused
		}
		earlier.Replayed = true
		return earlier, nil
	}
	if request.SenderUserId == request.ReceiverUserId {
		return ports.ChargedGift{}, ports.ErrCannotGiftSelf
	}
	total := request.UnitPriceCoins * int64(request.Quantity)
	if gateway.balanceLocked(request.SenderUserId) < total {
		return ports.ChargedGift{}, ports.ErrInsufficientCoins
	}
	gateway.Balances[request.SenderUserId] = gateway.balanceLocked(request.SenderUserId) - total
	creator := total * gateway.CreatorShareBps / 10_000
	if request.BattleId != "" {
		if gateway.holdings[request.BattleId] == nil {
			gateway.holdings[request.BattleId] = map[string]int64{}
		}
		gateway.holdings[request.BattleId][request.ReceiverUserId] += creator
		if gateway.battleGross[request.BattleId] == nil {
			gateway.battleGross[request.BattleId] = map[string]ports.BattleGiftTotal{}
		}
		total := gateway.battleGross[request.BattleId][request.ReceiverUserId]
		gateway.battleGross[request.BattleId][request.ReceiverUserId] = ports.BattleGiftTotal{ReceiverUserId: request.ReceiverUserId, GrossCoins: total.GrossCoins + gateway.chargeTotal(request), GiftCount: total.GiftCount + 1}
	} else {
		gateway.GiftEarnedCoins[request.ReceiverUserId] += creator
	}
	charged := ports.ChargedGift{
		GiftTransactionId: uuid.NewString(), CreditedUserId: request.ReceiverUserId, TotalCoins: total, PlatformFeeCoins: total - creator,
		CreatorAmountCoins: creator, Status: "committed", LedgerTransactionId: uuid.NewString(),
		SenderCoinBalance: gateway.Balances[request.SenderUserId], CreatedAt: time.Now(),
	}
	gateway.Charges[scopedKey] = charged
	gateway.chargeRequests[scopedKey] = request
	return charged, nil
}

func (gateway *MoneyGateway) GetCoinBalance(_ context.Context, userId string) (int64, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	return gateway.balanceLocked(userId), nil
}

func (gateway *MoneyGateway) chargeTotal(request ports.ChargeGiftRequest) int64 {
	return request.UnitPriceCoins * int64(request.Quantity)
}

func (gateway *MoneyGateway) GetBattleGiftTotals(_ context.Context, battleId string) ([]ports.BattleGiftTotal, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	totals := []ports.BattleGiftTotal{}
	for _, total := range gateway.battleGross[battleId] {
		totals = append(totals, total)
	}
	return totals, nil
}
