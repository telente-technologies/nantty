package services

import (
	"context"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/interfaces"
	"sort"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/battleparticipant"
)

func (service *LiveService) applyGiftEffects(ctx context.Context, tx *ent.Tx, session *ent.LiveSession, gift committedGift, catalogGift *ent.Gift, sender interfaces.Participant) error {
	if err := tx.LiveSession.UpdateOneID(session.ID).AddGiftCount(int64(gift.Quantity)).AddTotalCoins(gift.TotalCoins).AddCreatorCoins(gift.CreatorAmountCoins).Exec(ctx); err != nil {
		return err
	}
	if err := service.addContribution(ctx, tx, gift, liveScopeKey); err != nil {
		return err
	}
	if err := service.applyGiftToActiveGoal(ctx, tx, session.ID, gift); err != nil {
		return err
	}
	if gift.BattleId != nil {
		if err := service.creditBattleScore(ctx, tx, session.ID, gift); err != nil {
			return err
		}
	}
	if err := service.awardGiftPoints(ctx, tx, session, gift); err != nil {
		return err
	}
	err := events.EnqueueOutboxEventInTransaction(ctx, tx, events.GiftSent, session.ID.String(), gift.CreatedAt, events.GiftSentEventData{
		LiveId: session.ID.String(), GiftTransactionId: gift.Id.String(), GiftId: gift.GiftId, AnimationAssetKey: catalogGift.AnimationAssetKey,
		DisplayLevel: string(catalogGift.DisplayLevel), Quantity: gift.Quantity, TotalCoins: gift.TotalCoins,
		Sender:         events.GiftSender{Id: sender.Id.String(), Name: sender.Name, AvatarUrl: sender.AvatarUrl},
		ReceiverUserId: gift.ReceiverId.String(), ComboId: gift.ComboId, ComboCount: gift.ComboCount, BattleId: formatOptionalUuid(gift.BattleId),
	})
	if err != nil {
		return err
	}
	return service.emitLeaderboardUpdated(ctx, tx, session.ID)
}

func (service *LiveService) addContribution(ctx context.Context, tx *ent.Tx, gift committedGift, scopeKey string) error {
	return tx.GiftContribution.Create().SetLiveID(gift.LiveId).SetScopeKey(scopeKey).SetReceiverID(gift.ReceiverId).SetSenderID(gift.SenderId).
		SetCoins(gift.TotalCoins).SetGiftCount(int64(gift.Quantity)).
		OnConflictColumns("live_id", "scope_key", "receiver_id", "sender_id").
		AddCoins(gift.TotalCoins).AddGiftCount(int64(gift.Quantity)).Exec(ctx)
}

func (service *LiveService) awardGiftPoints(ctx context.Context, tx *ent.Tx, session *ent.LiveSession, gift committedGift) error {
	supportRate, err := service.readPointsPerCoin(ctx, tx, "gift")
	if err != nil {
		return err
	}
	streamRate, err := service.readPointsPerCoin(ctx, tx, "giftReceived")
	if err != nil {
		return err
	}
	return service.recordPointsInTransaction(ctx, tx, service.loadPointsContext(session),
		pointsAward{UserId: gift.SenderId, Type: "support", Amount: gift.TotalCoins * supportRate, SourceType: "gift", SourceId: gift.Id.String(), IdempotencyKey: "gift:" + gift.Id.String() + ":support"},
		pointsAward{UserId: gift.ReceiverId, Type: "stream", Amount: gift.TotalCoins * streamRate, SourceType: "gift", SourceId: gift.Id.String(), IdempotencyKey: "gift:" + gift.Id.String() + ":stream"},
	)
}

func (service *LiveService) creditBattleScore(ctx context.Context, tx *ent.Tx, liveId uuid.UUID, gift committedGift) error {
	battleId := *gift.BattleId
	err := tx.BattleParticipant.Update().Where(battleparticipant.BattleID(battleId), battleparticipant.UserID(gift.ReceiverId), battleparticipant.StateEQ(battleparticipant.StateActive)).
		AddScore(gift.TotalCoins).Exec(ctx)
	if err != nil {
		return err
	}
	if err := service.addContribution(ctx, tx, gift, battleScopeKey(battleId)); err != nil {
		return err
	}
	if err := tx.BattleGiftEvent.Create().SetBattleID(battleId).SetSenderID(gift.SenderId).SetReceiverID(gift.ReceiverId).SetGiftID(gift.GiftId).SetCoins(gift.TotalCoins).Exec(ctx); err != nil {
		return err
	}
	rows, err := service.loadParticipants(ctx, tx, battleId)
	if err != nil {
		return err
	}
	totals, err := totalGiftsByReceiverAndSender(ctx, tx.Client(), liveId, battleId)
	if err != nil {
		return err
	}
	scores := make([]FinalScore, 0, len(rows))
	topGifters := map[string][]events.GoalContributor{}
	for _, participant := range rows {
		scores = append(scores, FinalScore{UserId: participant.UserID.String(), Score: participant.Score})
		topGifters[participant.UserID.String()] = topContributorsForReceiver(totals, participant.UserID)
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.BattleScoreUpdated, liveId.String(), service.Now(), map[string]any{
		"liveId": liveId.String(), "battleId": battleId.String(), "scores": scores, "topGifters": topGifters,
	})
}

func topContributorsForReceiver(totals []gifterTotal, receiver uuid.UUID) []events.GoalContributor {
	contributors := []events.GoalContributor{}
	for _, total := range totals {
		if total.ReceiverID == receiver {
			contributors = append(contributors, events.GoalContributor{UserId: total.SenderID.String(), Coins: total.Coins})
		}
	}
	sort.SliceStable(contributors, func(left, right int) bool { return contributors[left].Coins > contributors[right].Coins })
	if len(contributors) > 3 {
		contributors = contributors[:3]
	}
	return contributors
}
