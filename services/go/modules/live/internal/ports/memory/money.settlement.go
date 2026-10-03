package memory

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ports"
)

func (gateway *MoneyGateway) SettleBattle(_ context.Context, request ports.SettleBattleRequest) (ports.BattleSettlement, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	gateway.SettleCallCount[request.BattleId]++
	if gateway.FailSettlementOn {
		return ports.BattleSettlement{}, errors.New("money unavailable")
	}
	if earlier, settled := gateway.Settlements[request.BattleId]; settled {
		return earlier, nil
	}
	rule := request.Rule
	if request.WinnerUserId == "" {
		rule = ports.SettlementRuleKeepOwn
	}
	settlement := ports.BattleSettlement{BattleId: request.BattleId, RuleApplied: rule, WinnerUserId: request.WinnerUserId, LedgerTransactionId: uuid.NewString(), SettledAt: time.Now()}
	for _, participant := range request.Participants {
		holding := gateway.holdings[request.BattleId][participant.UserId]
		credited := participant.UserId
		movesToWinner := rule == ports.SettlementRuleWinnerTA && participant.UserId != request.WinnerUserId && participant.Outcome != ports.OutcomeRemovedByHost
		if movesToWinner {
			credited = request.WinnerUserId
			if holding > 0 {
				settlement.Transfers = append(settlement.Transfers, ports.CoinTransfer{FromUserId: participant.UserId, ToUserId: request.WinnerUserId, Coins: holding})
			}
		}
		gateway.GiftEarnedCoins[credited] += holding
		settlement.Payouts = append(settlement.Payouts, ports.ParticipantPayout{UserId: participant.UserId, HoldingCoins: holding, CreditedUserId: credited})
	}
	gateway.Settlements[request.BattleId] = settlement
	return settlement, nil
}
