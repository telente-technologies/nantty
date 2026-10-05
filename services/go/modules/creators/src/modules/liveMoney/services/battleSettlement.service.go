package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"time"

	"zudomart/modules/creators/src/generated/ent"
	"zudomart/modules/creators/src/generated/ent/battlesettlement"
	"zudomart/modules/creators/src/generated/ent/gifttransaction"
	programservices "zudomart/modules/creators/src/modules/creatorProgram/services"
	"zudomart/modules/creators/src/modules/liveMoney/models"
	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	ledgerutils "zudomart/modules/ledger/src/utils"
)

type BattleParticipantRequest struct {
	UserId  string
	Outcome models.ParticipantOutcome
}

type SettleBattleRequest struct {
	BattleId     string
	LiveId       string
	HostUserId   string
	Rule         string
	WinnerUserId string
	Participants []BattleParticipantRequest
}

type SettledBattle struct {
	Settlement *ent.BattleSettlement
	Payouts    []models.BattlePayout
	Transfers  []models.BattleTransfer
	Replayed   bool
}

func validateSettleBattleRequest(request SettleBattleRequest) error {
	if request.BattleId == "" || request.LiveId == "" || request.HostUserId == "" || len(request.Participants) == 0 || len(request.Participants) > 10 {
		return invalidArgument("battle, live, host and 1-10 participants are required")
	}
	if request.Rule != "keepOwn" && request.Rule != "winnerTakesAll" {
		return invalidArgument("rule must be keep own or winner takes all")
	}
	seen := map[string]bool{}
	for _, participant := range request.Participants {
		if participant.UserId == "" || seen[participant.UserId] {
			return invalidArgument("participants must be unique and non-empty")
		}
		seen[participant.UserId] = true
	}
	return nil
}

func (live LiveMoney) SettleBattle(ctx context.Context, request SettleBattleRequest) (SettledBattle, error) {
	if err := validateSettleBattleRequest(request); err != nil {
		return SettledBattle{}, err
	}
	canonical := request
	canonical.Participants = append([]BattleParticipantRequest{}, request.Participants...)
	sort.Slice(canonical.Participants, func(left, right int) bool {
		return canonical.Participants[left].UserId < canonical.Participants[right].UserId
	})
	requestHash := ledgerutils.HashRequestFingerprint(canonical)
	var settled SettledBattle
	err := databases.RunInMoneyTransaction(ctx, live.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		settled, err = live.settleBattleInTransaction(ctx, transaction, request, requestHash)
		return err
	})
	return settled, err
}

func (live LiveMoney) settleBattleInTransaction(ctx context.Context, transaction *sql.Tx, request SettleBattleRequest, requestHash string) (SettledBattle, error) {
	client := live.Container.Client(transaction)
	if _, err := client.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "battle-settle:"+request.BattleId); err != nil {
		return SettledBattle{}, err
	}
	existing, err := client.BattleSettlement.Query().Where(battlesettlement.BattleID(request.BattleId)).Only(ctx)
	if err == nil {
		if existing.RequestHash != requestHash {
			return SettledBattle{}, failedPrecondition("BATTLE_ALREADY_SETTLED_DIFFERENTLY", "This battle was already settled with different inputs.")
		}
		return decodeSettlement(existing, true)
	}
	if !ent.IsNotFound(err) {
		return SettledBattle{}, err
	}
	holdings, err := live.readBattleHoldings(ctx, transaction, request)
	if err != nil {
		return SettledBattle{}, err
	}
	resolveCredited := live.Program.CreditableUserResolver(ctx, transaction, request.HostUserId)
	var resolveError error
	plan, err := models.PlanBattleSettlement(request.Rule, request.WinnerUserId, holdings, func(userId string) string {
		credited, err := resolveCredited(userId)
		if err != nil && resolveError == nil {
			resolveError = err
		}
		return credited
	})
	if errors.Is(err, models.ErrUnknownWinner) {
		return SettledBattle{}, invalidArgument("the winner must be an active participant")
	}
	if err != nil {
		return SettledBattle{}, err
	}
	if resolveError != nil {
		if errors.Is(resolveError, programservices.ErrRecipientCannotReceiveGifts) {
			return SettledBattle{}, failedPrecondition("RECIPIENT_CANNOT_RECEIVE_GIFTS", "The host is not in the Creator Program, so battle holdings cannot be paid out.")
		}
		return SettledBattle{}, resolveError
	}
	return live.postAndRecordSettlement(ctx, transaction, client, request, requestHash, plan)
}

func (live LiveMoney) readBattleHoldings(ctx context.Context, transaction *sql.Tx, request SettleBattleRequest) ([]models.BattleHolding, error) {
	prefix := ledgermodels.BattleHoldingCoinsAccountCodePrefix(request.BattleId)
	balances, err := live.Container.Ledger.ListBalancesOfAccountsWithCodePrefix(ctx, transaction, prefix, ledgermodels.CoinUnit)
	if err != nil {
		return nil, err
	}
	outcomes := map[string]models.ParticipantOutcome{}
	for _, participant := range request.Participants {
		outcomes[participant.UserId] = participant.Outcome
	}
	holdings := []models.BattleHolding{}
	seen := map[string]bool{}
	for _, balance := range balances {
		userId := strings.TrimPrefix(balance.Code, prefix)
		outcome, listed := outcomes[userId]
		if !listed {
			outcome = models.OutcomeRemovedByHost
		}
		holdings = append(holdings, models.BattleHolding{UserId: userId, Outcome: outcome, HoldingCoins: balance.BalanceMinor})
		seen[userId] = true
	}
	for _, participant := range request.Participants {
		if !seen[participant.UserId] {
			holdings = append(holdings, models.BattleHolding{UserId: participant.UserId, Outcome: participant.Outcome})
		}
	}
	return holdings, nil
}

func (live LiveMoney) postAndRecordSettlement(ctx context.Context, transaction *sql.Tx, client *ent.Client, request SettleBattleRequest, requestHash string, plan models.BattleSettlementPlan) (SettledBattle, error) {
	var lines []ledgermodels.JournalLineRequest
	for _, payout := range plan.Payouts {
		if payout.HoldingCoins <= 0 {
			continue
		}
		lines = append(lines,
			ledgermodels.JournalLineRequest{Account: ledgermodels.BattleHoldingCoinsAccount(request.BattleId, payout.UserId), Direction: ledgermodels.Debit, AmountMinor: payout.HoldingCoins},
			ledgermodels.JournalLineRequest{Account: ledgermodels.CreatorEarnedCoinsAccount(payout.CreditedUserId), Direction: ledgermodels.Credit, AmountMinor: payout.HoldingCoins},
		)
	}
	create := client.BattleSettlement.Create().SetBattleID(request.BattleId).SetLiveID(request.LiveId).SetHostUserID(request.HostUserId).
		SetRequestedRule(battlesettlement.RequestedRule(request.Rule)).SetRuleApplied(battlesettlement.RuleApplied(plan.RuleApplied)).
		SetWinnerUserID(plan.WinnerId).SetRequestHash(requestHash).SetCreatedAt(live.Container.Now().UTC())
	if len(lines) > 0 {
		posted, err := live.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: "battle-settle:" + request.BattleId, Kind: "battle.settled", Description: "Battle holdings paid out",
			Metadata: map[string]any{"battleId": request.BattleId, "rule": plan.RuleApplied, "winnerUserId": plan.WinnerId}, Lines: lines,
		})
		if err != nil {
			return SettledBattle{}, err
		}
		create.SetLedgerEntryID(posted.Id)
	}
	payouts, _ := json.Marshal(nonNil(plan.Payouts))
	transfers, _ := json.Marshal(nonNil(plan.Transfers))
	settlement, err := create.SetPayouts(payouts).SetTransfers(transfers).Save(ctx)
	if err != nil {
		return SettledBattle{}, err
	}
	for _, payout := range plan.Payouts {
		if payout.HoldingCoins <= 0 {
			continue
		}
		if _, err := programservices.RecordEarning(ctx, client, programservices.Earning{
			CreatorId: payout.CreditedUserId, Kind: "gift", Reference: "battle:" + request.BattleId + ":" + payout.UserId, SourceType: "live", SourceId: request.LiveId,
			Description: "Battle gifts", GrossMinor: payout.HoldingCoins, NetMinor: payout.HoldingCoins, Unit: programservices.CoinUnit, At: settlement.CreatedAt,
		}); err != nil {
			return SettledBattle{}, err
		}
	}
	if err := live.Container.Outbox.EnqueueInTransaction(ctx, transaction, "battleSettlement.completed", request.LiveId, settlement.CreatedAt, map[string]any{
		"battleId": request.BattleId, "liveId": request.LiveId, "rule": plan.RuleApplied, "winnerUserId": plan.WinnerId, "transfers": nonNil(plan.Transfers),
	}); err != nil {
		return SettledBattle{}, err
	}
	return SettledBattle{Settlement: settlement, Payouts: plan.Payouts, Transfers: nonNil(plan.Transfers)}, nil
}

func decodeSettlement(settlement *ent.BattleSettlement, replayed bool) (SettledBattle, error) {
	decoded := SettledBattle{Settlement: settlement, Replayed: replayed}
	if err := json.Unmarshal(settlement.Payouts, &decoded.Payouts); err != nil {
		return SettledBattle{}, err
	}
	return decoded, json.Unmarshal(settlement.Transfers, &decoded.Transfers)
}

func nonNil[Item any](items []Item) []Item {
	if items == nil {
		return []Item{}
	}
	return items
}

type BattleGiftTotal struct {
	ReceiverUserId string
	GrossCoins     int64
	GiftCount      int64
	ReachedAt      time.Time
}

func (live LiveMoney) ReadBattleGiftTotals(ctx context.Context, battleId string) ([]BattleGiftTotal, error) {
	if battleId == "" {
		return nil, invalidArgument("battle_id is required")
	}
	var rows []struct {
		ReceiverUserId string    `json:"receiver_user_id"`
		Sum            int64     `json:"sum"`
		Count          int64     `json:"count"`
		Max            time.Time `json:"max"`
	}
	err := live.Container.Client(live.Container.Resources.Database).GiftTransaction.Query().
		Where(gifttransaction.BattleID(battleId), gifttransaction.StatusEQ(gifttransaction.StatusCommitted)).
		GroupBy(gifttransaction.FieldReceiverUserID).
		Aggregate(ent.Sum(gifttransaction.FieldTotalCoins), ent.Count(), ent.Max(gifttransaction.FieldCreatedAt)).Scan(ctx, &rows)
	if err != nil {
		return nil, err
	}
	totals := make([]BattleGiftTotal, len(rows))
	for index, row := range rows {
		totals[index] = BattleGiftTotal{ReceiverUserId: row.ReceiverUserId, GrossCoins: row.Sum, GiftCount: row.Count, ReachedAt: row.Max}
	}
	return totals, nil
}
