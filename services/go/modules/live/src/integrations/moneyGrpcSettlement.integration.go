package integrations

import (
	"context"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	"nantty/modules/live/src/interfaces"
)

func (client *MoneyClient) SettleBattle(ctx context.Context, request interfaces.SettleBattleRequest) (interfaces.BattleSettlement, error) {
	message := &moneyv1.SettleBattleRequest{BattleId: request.BattleId, LiveId: request.LiveId, HostUserId: request.HostUserId, Rule: describeRule(request.Rule)}
	if request.WinnerUserId != "" {
		message.WinnerUserId = &request.WinnerUserId
	}
	for _, participant := range request.Participants {
		message.Participants = append(message.Participants, &moneyv1.BattleParticipant{UserId: participant.UserId, Outcome: describeOutcome(participant.Outcome)})
	}
	response, err := callWithRetryOnUnavailable(ctx, client.options, true, func(attempt context.Context) (*moneyv1.SettleBattleResponse, error) {
		return client.service.SettleBattle(attempt, message)
	})
	if err != nil {
		return interfaces.BattleSettlement{}, translateMoneyError(err)
	}
	settlement := response.GetSettlement()
	result := interfaces.BattleSettlement{
		BattleId: settlement.GetBattleId(), RuleApplied: describeAppliedRule(settlement.GetRuleApplied()), WinnerUserId: settlement.GetWinnerUserId(),
		LedgerTransactionId: settlement.GetLedgerTransactionId(), SettledAt: settlement.GetSettledAt().AsTime(),
	}
	for _, payout := range settlement.GetPayouts() {
		result.Payouts = append(result.Payouts, interfaces.ParticipantPayout{UserId: payout.GetUserId(), HoldingCoins: payout.GetHoldingCoins(), CreditedUserId: payout.GetCreditedUserId()})
	}
	for _, transfer := range settlement.GetTransfers() {
		result.Transfers = append(result.Transfers, interfaces.CoinTransfer{FromUserId: transfer.GetFromUserId(), ToUserId: transfer.GetToUserId(), Coins: transfer.GetCoins()})
	}
	return result, nil
}

func describeRule(rule string) moneyv1.BattleSettlementRule {
	if rule == interfaces.SettlementRuleWinnerTA {
		return moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_WINNER_TAKES_ALL
	}
	return moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_KEEP_OWN
}

func describeAppliedRule(rule moneyv1.BattleSettlementRule) string {
	if rule == moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_WINNER_TAKES_ALL {
		return interfaces.SettlementRuleWinnerTA
	}
	return interfaces.SettlementRuleKeepOwn
}

func describeOutcome(outcome interfaces.BattleParticipantOutcome) moneyv1.BattleParticipantOutcome {
	switch outcome {
	case interfaces.OutcomeForfeited:
		return moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_FORFEITED
	case interfaces.OutcomeRemovedByHost:
		return moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_REMOVED_BY_HOST
	default:
		return moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_ACTIVE
	}
}
