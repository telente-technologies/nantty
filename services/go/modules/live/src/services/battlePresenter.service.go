package services

import (
	"context"
	"encoding/json"
	"nantty/modules/live/src/types"
	"sort"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
	"nantty/modules/live/src/generated/ent/battleparticipant"
	"nantty/modules/live/src/generated/ent/giftcontribution"
)

type StoredSettlement struct {
	RuleApplied         string                     `json:"ruleApplied"`
	LedgerTransactionId string                     `json:"ledgerTransactionId"`
	Transfers           []types.BattleTransferView `json:"transfers"`
	Payouts             []types.BattlePayoutView   `json:"payouts"`
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
	return endsAt.Add((BattleSettlingDisplaySeconds + BattleResultDisplaySeconds) * time.Second)
}

type gifterTotal struct {
	ReceiverID uuid.UUID `json:"receiver_id"`
	SenderID   uuid.UUID `json:"sender_id"`
	Coins      int64     `json:"coins"`
}

func battleScopeKey(battleId uuid.UUID) string { return "battle:" + battleId.String() }

func totalGiftsByReceiverAndSender(ctx context.Context, db *ent.Client, liveId, battleId uuid.UUID) ([]gifterTotal, error) {
	rows, err := db.GiftContribution.Query().Where(giftcontribution.LiveID(liveId), giftcontribution.ScopeKey(battleScopeKey(battleId))).All(ctx)
	if err != nil {
		return nil, err
	}
	totals := make([]gifterTotal, 0, len(rows))
	for _, row := range rows {
		totals = append(totals, gifterTotal{ReceiverID: row.ReceiverID, SenderID: row.SenderID, Coins: row.Coins})
	}
	return totals, nil
}

func (service *LiveService) presentBattle(ctx context.Context, db *ent.Client, battle *ent.Battle) (types.BattleView, error) {
	rows, err := db.BattleParticipant.Query().Where(battleparticipant.BattleID(battle.ID)).Order(ent.Asc(battleparticipant.FieldCreatedAt)).All(ctx)
	if err != nil {
		return types.BattleView{}, err
	}
	totals, err := totalGiftsByReceiverAndSender(ctx, db, battle.LiveID, battle.ID)
	if err != nil {
		return types.BattleView{}, err
	}
	identifiers := []uuid.UUID{}
	for _, row := range rows {
		identifiers = append(identifiers, row.UserID)
	}
	for _, total := range totals {
		identifiers = append(identifiers, total.SenderID)
	}
	participants, err := service.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return types.BattleView{}, err
	}
	summaries := summariesById(participants)
	facts := make([]ParticipantFacts, 0, len(rows))
	for _, row := range rows {
		facts = append(facts, ParticipantFacts{UserId: row.UserID.String(), State: ParticipantState(row.State), Score: row.Score})
	}
	ranks := RankActiveParticipants(facts)
	views := make([]types.BattleParticipantView, 0, len(rows))
	for _, row := range rows {
		gifters := topGiftersFor(totals, row.UserID, summaries)
		views = append(views, types.BattleParticipantView{
			UserId: row.UserID.String(), User: summaries[row.UserID], Score: row.Score, Rank: ranks[row.UserID.String()],
			State: string(row.State), TopGifters: gifters,
		})
	}
	return assembleBattleView(battle, views), nil
}

func topGiftersFor(totals []gifterTotal, receiver uuid.UUID, summaries map[uuid.UUID]types.UserSummary) []types.BattleGifterView {
	gifters := []types.BattleGifterView{}
	for _, total := range totals {
		if total.ReceiverID == receiver {
			gifters = append(gifters, types.BattleGifterView{UserId: total.SenderID.String(), User: summaries[total.SenderID], Coins: total.Coins})
		}
	}
	sort.SliceStable(gifters, func(left, right int) bool { return gifters[left].Coins > gifters[right].Coins })
	if len(gifters) > 3 {
		gifters = gifters[:3]
	}
	return gifters
}

func assembleBattleView(battle *ent.Battle, participants []types.BattleParticipantView) types.BattleView {
	startsAt, endsAt := time.Time{}, time.Time{}
	if battle.StartsAt != nil {
		startsAt = *battle.StartsAt
	}
	if battle.EndsAt != nil {
		endsAt = *battle.EndsAt
	}
	countdownStartedAt := startsAt.Add(-BattleCountdownSeconds * time.Second)
	if battle.CountdownStartedAt != nil {
		countdownStartedAt = *battle.CountdownStartedAt
	}
	state := string(battle.State)
	if battle.State == battlerecord.StateEnded {
		state = "settling"
	}
	view := types.BattleView{
		Id: battle.ID.String(), LiveId: battle.LiveID.String(), State: state, WinnerTakesAll: battle.WinnerTakesAll, DurationSeconds: battle.DurationSeconds,
		CountdownStartedAt: formatTime(countdownStartedAt), StartsAt: formatTime(startsAt), EndsAt: formatTime(endsAt),
		SettledAt: formatOptionalTime(battle.SettledAt), CelebrationEndsAt: formatTime(celebrationEndsAt(endsAt)), Participants: participants,
		WinnerUserIds: []string{}, Transfers: []types.BattleTransferView{}, Payouts: []types.BattlePayoutView{},
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

func pickMostValuableGifter(participants []types.BattleParticipantView, winnerUserIds []string) *types.BattleGifterView {
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

func nonNilTransfers(transfers []types.BattleTransferView) []types.BattleTransferView {
	if transfers == nil {
		return []types.BattleTransferView{}
	}
	return transfers
}

func nonNilPayouts(payouts []types.BattlePayoutView) []types.BattlePayoutView {
	if payouts == nil {
		return []types.BattlePayoutView{}
	}
	return payouts
}
