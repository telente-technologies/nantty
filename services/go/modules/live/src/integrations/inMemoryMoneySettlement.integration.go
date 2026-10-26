package integrations

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/interfaces"
)

func (gateway *InMemoryMoneyGateway) SettleBattle(_ context.Context, request interfaces.SettleBattleRequest) (interfaces.BattleSettlement, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	gateway.SettleCallCount[request.BattleId]++
	if gateway.FailSettlementOn {
		return interfaces.BattleSettlement{}, errors.New("money unavailable")
	}
	if earlier, settled := gateway.Settlements[request.BattleId]; settled {
		return earlier, nil
	}
	rule := request.Rule
	if request.WinnerUserId == "" {
		rule = interfaces.SettlementRuleKeepOwn
	}
	settlement := interfaces.BattleSettlement{BattleId: request.BattleId, RuleApplied: rule, WinnerUserId: request.WinnerUserId, LedgerTransactionId: uuid.NewString(), SettledAt: time.Now()}
	for _, participant := range request.Participants {
		holding := gateway.holdings[request.BattleId][participant.UserId]
		credited := participant.UserId
		movesToWinner := rule == interfaces.SettlementRuleWinnerTA && participant.UserId != request.WinnerUserId && participant.Outcome != interfaces.OutcomeRemovedByHost
		if movesToWinner {
			credited = request.WinnerUserId
			if holding > 0 {
				settlement.Transfers = append(settlement.Transfers, interfaces.CoinTransfer{FromUserId: participant.UserId, ToUserId: request.WinnerUserId, Coins: holding})
			}
		}
		gateway.GiftEarnedCoins[credited] += holding
		settlement.Payouts = append(settlement.Payouts, interfaces.ParticipantPayout{UserId: participant.UserId, HoldingCoins: holding, CreditedUserId: credited})
	}
	gateway.Settlements[request.BattleId] = settlement
	return settlement, nil
}
