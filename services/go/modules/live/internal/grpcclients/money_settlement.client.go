package grpcclients

import (
	"context"

	moneyv1 "zudomart/contracts/gen/go/zudomart/money/v1"
	"zudomart/modules/live/internal/ports"
)

func (client *MoneyClient) SettleBattle(ctx context.Context, request ports.SettleBattleRequest) (ports.BattleSettlement, error) {
	message := &moneyv1.SettleBattleRequest{BattleId: request.BattleId, LiveId: request.LiveId, HostUserId: request.HostUserId, Rule: describeRule(request.Rule)}
	if request.WinnerUserId != "" {
		message.WinnerUserId = &request.WinnerUserId
	}
	for _, participant := range request.Participants {
		message.Participants = append(message.Participants, &moneyv1.BattleParticipant{UserId: participant.UserId, Outcome: describeOutcome(participant.Outcome)})
	}
	response, err := client.service.SettleBattle(ctx, message)
	if err != nil {
		return ports.BattleSettlement{}, translateMoneyError(err)
	}
	settlement := response.GetSettlement()
	result := ports.BattleSettlement{
		BattleId: settlement.GetBattleId(), RuleApplied: describeAppliedRule(settlement.GetRuleApplied()), WinnerUserId: settlement.GetWinnerUserId(),
		LedgerTransactionId: settlement.GetLedgerTransactionId(), SettledAt: settlement.GetSettledAt().AsTime(),
	}
	for _, payout := range settlement.GetPayouts() {
		result.Payouts = append(result.Payouts, ports.ParticipantPayout{UserId: payout.GetUserId(), HoldingCoins: payout.GetHoldingCoins(), CreditedUserId: payout.GetCreditedUserId()})
	}
	for _, transfer := range settlement.GetTransfers() {
		result.Transfers = append(result.Transfers, ports.CoinTransfer{FromUserId: transfer.GetFromUserId(), ToUserId: transfer.GetToUserId(), Coins: transfer.GetCoins()})
	}
	return result, nil
}

func describeRule(rule string) moneyv1.BattleSettlementRule {
	if rule == ports.SettlementRuleWinnerTA {
		return moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_WINNER_TAKES_ALL
	}
	return moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_KEEP_OWN
}

func describeAppliedRule(rule moneyv1.BattleSettlementRule) string {
	if rule == moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_WINNER_TAKES_ALL {
		return ports.SettlementRuleWinnerTA
	}
	return ports.SettlementRuleKeepOwn
}

func describeOutcome(outcome ports.BattleParticipantOutcome) moneyv1.BattleParticipantOutcome {
	switch outcome {
	case ports.OutcomeForfeited:
		return moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_FORFEITED
	case ports.OutcomeRemovedByHost:
		return moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_REMOVED_BY_HOST
	default:
		return moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_ACTIVE
	}
}
