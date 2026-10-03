package application

import (
	"context"
	"encoding/json"
	"sort"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ent/battleparticipant"
	"zudomart/modules/live/internal/ent/gifttransaction"
)

type StoredSettlement struct {
	RuleApplied         string               `json:"ruleApplied"`
	LedgerTransactionId string               `json:"ledgerTransactionId"`
	Transfers           []BattleTransferView `json:"transfers"`
	Payouts             []BattlePayoutView   `json:"payouts"`
}

func readStoredSettlement(raw map[string]any) StoredSettlement {
	var stored StoredSettlement
	encoded, err := json.Marshal(raw)
	if err == nil {
		_ = json.Unmarshal(encoded, &stored)
	}
	return stored
}

func writeStoredSettlement(stored StoredSettlement) map[string]any {
	encoded, _ := json.Marshal(stored)
	var raw map[string]any
	_ = json.Unmarshal(encoded, &raw)
	return raw
}

func celebrationEndsAt(endsAt time.Time) time.Time {
	return endsAt.Add((domain.BattleSettlingDisplaySeconds + domain.BattleResultDisplaySeconds) * time.Second)
}

type gifterTotal struct {
	ReceiverID uuid.UUID `json:"receiver_id"`
	SenderID   uuid.UUID `json:"sender_id"`
	Coins      int64     `json:"coins"`
}

func totalGiftsByReceiverAndSender(ctx context.Context, db *ent.Client, battleId uuid.UUID, before *time.Time) ([]gifterTotal, error) {
	query := db.GiftTransaction.Query().Where(gifttransaction.BattleID(battleId))
	if before != nil {
		query = query.Where(gifttransaction.CreatedAtLTE(*before))
	}
	var totals []gifterTotal
	err := query.GroupBy(gifttransaction.FieldReceiverID, gifttransaction.FieldSenderID).
		Aggregate(ent.As(ent.Sum(gifttransaction.FieldTotalCoins), "coins")).Scan(ctx, &totals)
	return totals, err
}

func (application *LiveApplication) presentBattle(ctx context.Context, db *ent.Client, battle *ent.Battle) (BattleView, error) {
	rows, err := db.BattleParticipant.Query().Where(battleparticipant.BattleID(battle.ID)).Order(ent.Asc(battleparticipant.FieldCreatedAt)).All(ctx)
	if err != nil {
		return BattleView{}, err
	}
	totals, err := totalGiftsByReceiverAndSender(ctx, db, battle.ID, battle.EndsAt)
	if err != nil {
		return BattleView{}, err
	}
	identifiers := []uuid.UUID{}
	for _, row := range rows {
		identifiers = append(identifiers, row.UserID)
	}
	for _, total := range totals {
		identifiers = append(identifiers, total.SenderID)
	}
	participants, err := application.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return BattleView{}, err
	}
	summaries := summariesById(participants)
	facts := make([]domain.ParticipantFacts, 0, len(rows))
	for _, row := range rows {
		facts = append(facts, domain.ParticipantFacts{UserId: row.UserID.String(), State: domain.ParticipantState(row.State), Score: row.Score})
	}
	ranks := domain.RankActiveParticipants(facts)
	views := make([]BattleParticipantView, 0, len(rows))
	for _, row := range rows {
		gifters := topGiftersFor(totals, row.UserID, summaries)
		views = append(views, BattleParticipantView{
			UserId: row.UserID.String(), User: summaries[row.UserID], Score: row.Score, Rank: ranks[row.UserID.String()],
			State: string(row.State), TopGifters: gifters,
		})
	}
	return assembleBattleView(battle, views), nil
}

func topGiftersFor(totals []gifterTotal, receiver uuid.UUID, summaries map[uuid.UUID]UserSummary) []BattleGifterView {
	gifters := []BattleGifterView{}
	for _, total := range totals {
		if total.ReceiverID == receiver {
			gifters = append(gifters, BattleGifterView{UserId: total.SenderID.String(), User: summaries[total.SenderID], Coins: total.Coins})
		}
	}
	sort.SliceStable(gifters, func(left, right int) bool { return gifters[left].Coins > gifters[right].Coins })
	if len(gifters) > 3 {
		gifters = gifters[:3]
	}
	return gifters
}

func assembleBattleView(battle *ent.Battle, participants []BattleParticipantView) BattleView {
	startsAt, endsAt := time.Time{}, time.Time{}
	if battle.StartsAt != nil {
		startsAt = *battle.StartsAt
	}
	if battle.EndsAt != nil {
		endsAt = *battle.EndsAt
	}
	countdownStartedAt := startsAt.Add(-domain.BattleCountdownSeconds * time.Second)
	if battle.CountdownStartedAt != nil {
		countdownStartedAt = *battle.CountdownStartedAt
	}
	state := string(battle.State)
	if battle.State == battlerecord.StateEnded {
		state = "settling"
	}
	view := BattleView{
		Id: battle.ID.String(), LiveId: battle.LiveID.String(), State: state, WinnerTakesAll: battle.WinnerTakesAll, DurationSeconds: battle.DurationSeconds,
		CountdownStartedAt: formatTime(countdownStartedAt), StartsAt: formatTime(startsAt), EndsAt: formatTime(endsAt),
		SettledAt: formatOptionalTime(battle.SettledAt), CelebrationEndsAt: formatTime(celebrationEndsAt(endsAt)), Participants: participants,
		WinnerUserIds: []string{}, Transfers: []BattleTransferView{}, Payouts: []BattlePayoutView{},
	}
	if battle.EndReason != nil {
		reason := string(*battle.EndReason)
		view.EndReason = &reason
	}
	if battle.State == battlerecord.StateSettled {
		stored := readStoredSettlement(battle.Settlement)
		view.WinnerUserIds, view.IsTie = battle.WinnerUserIds, battle.IsTie
		view.Transfers, view.Payouts = nonNilTransfers(stored.Transfers), nonNilPayouts(stored.Payouts)
		view.MvpGifter = pickMostValuableGifter(participants, battle.WinnerUserIds)
	}
	return view
}

func pickMostValuableGifter(participants []BattleParticipantView, winnerUserIds []string) *BattleGifterView {
	if len(winnerUserIds) != 1 {
		return nil
	}
	for _, participant := range participants {
		if participant.UserId == winnerUserIds[0] && len(participant.TopGifters) > 0 {
			return &participant.TopGifters[0]
		}
	}
	return nil
}

func nonNilTransfers(transfers []BattleTransferView) []BattleTransferView {
	if transfers == nil {
		return []BattleTransferView{}
	}
	return transfers
}

func nonNilPayouts(payouts []BattlePayoutView) []BattlePayoutView {
	if payouts == nil {
		return []BattlePayoutView{}
	}
	return payouts
}
