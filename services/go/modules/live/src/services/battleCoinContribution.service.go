package services

import (
	"context"
	"errors"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/battleparticipant"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"
)

type BattleCoinContributionInput struct {
	RecipientUserID uuid.UUID
	Coins           int64
	IdempotencyKey  string
}

func (service *LiveService) ContributeCoinsToBattle(ctx context.Context, actor types.Actor, battleID uuid.UUID, input BattleCoinContributionInput) (uuid.UUID, error) {
	if input.Coins <= 0 || input.RecipientUserID == uuid.Nil || input.IdempotencyKey == "" {
		return uuid.Nil, liveerrors.Api(422, "INVALID_BATTLE_CONTRIBUTION", "A recipient, positive coin amount, and Idempotency-Key are required.")
	}
	if actor.UserId == input.RecipientUserID {
		return uuid.Nil, liveerrors.Api(403, "CANNOT_CONTRIBUTE_TO_SELF", "You cannot contribute coins to yourself.")
	}
	if service.Money == nil {
		return uuid.Nil, liveerrors.Api(503, "MONEY_UNAVAILABLE", "Battle coin contributions are temporarily unavailable.")
	}
	charged, err := service.Money.ContributeBattleCoins(ctx, interfaces.BattleCoinContributionRequest{
		SenderUserId: actor.UserId.String(), RecipientUserId: input.RecipientUserID.String(), BattleId: battleID.String(), Coins: input.Coins, IdempotencyKey: input.IdempotencyKey,
	})
	if err != nil {
		return uuid.Nil, battleContributionAPIError(err)
	}
	contributionID, err := uuid.Parse(charged.ContributionId)
	if err != nil {
		return uuid.Nil, liveerrors.Api(502, "MONEY_UNAVAILABLE", "The contribution service returned an invalid receipt.")
	}
	if charged.BattleId != battleID.String() || charged.SenderUserId != actor.UserId.String() || charged.RecipientUserId != input.RecipientUserID.String() {
		return uuid.Nil, liveerrors.Api(502, "MONEY_UNAVAILABLE", "The contribution service returned a mismatched receipt.")
	}
	chargedLiveID, err := uuid.Parse(charged.LiveId)
	if err != nil {
		return uuid.Nil, liveerrors.Api(502, "MONEY_UNAVAILABLE", "The contribution service returned an invalid live session.")
	}
	battle, err := service.Client.Battle.Get(ctx, battleID)
	if err != nil || battle.LiveID != chargedLiveID {
		return uuid.Nil, liveerrors.Api(502, "BATTLE_CONTRIBUTION_PROJECTION_FAILED", "The contribution committed, but its live stage could not be resolved. Retry with the same Idempotency-Key.")
	}
	if err := service.recordBattleCoinContribution(ctx, contributionID, actor.UserId, input.RecipientUserID, battle, charged); err != nil {
		return uuid.Nil, err
	}
	return chargedLiveID, nil
}

func battleContributionAPIError(err error) error {
	var amountPolicy *interfaces.BattleContributionAmountPolicyError
	switch {
	case errors.As(err, &amountPolicy):
		return liveerrors.Api(422, "INVALID_BATTLE_CONTRIBUTION_AMOUNT", "Choose a coin amount within the configured battle limits.").WithDetails(map[string]any{"minimumCoins": amountPolicy.MinimumCoins, "maximumCoins": amountPolicy.MaximumCoins})
	case errors.Is(err, interfaces.ErrInsufficientCoins):
		return liveerrors.Api(402, "INSUFFICIENT_COINS", "You do not have enough coins.")
	case errors.Is(err, interfaces.ErrCannotGiftSelf):
		return liveerrors.Api(403, "CANNOT_CONTRIBUTE_TO_SELF", "You cannot contribute coins to yourself.")
	case errors.Is(err, interfaces.ErrIdempotencyKeyReused):
		return liveerrors.Unprocessable("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was used with a different contribution.")
	case errors.Is(err, interfaces.ErrBattleNotActive):
		return liveerrors.Api(409, "BATTLE_NOT_ACTIVE", "Coin contributions are available only during an active battle.")
	case errors.Is(err, interfaces.ErrBattleParticipantInactive):
		return liveerrors.Api(403, "BATTLE_PARTICIPANT_INACTIVE", "Sender and recipient must both be active participants in this battle.")
	case errors.Is(err, interfaces.ErrBattleRecipientIneligible):
		return liveerrors.Api(409, "RECIPIENT_CANNOT_RECEIVE_COINS", "This participant is not eligible to receive coin contributions.")
	default:
		return liveerrors.Api(503, "MONEY_UNAVAILABLE", "Battle coin contributions are temporarily unavailable. Retry with the same Idempotency-Key.")
	}
}

func (service *LiveService) recordBattleCoinContribution(ctx context.Context, contributionID, senderID, recipientID uuid.UUID, battle *ent.Battle, charged interfaces.BattleCoinContributionReceipt) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		result, err := tx.ExecContext(ctx, "INSERT INTO processed_battle_coin_contributions (id, created_at) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", contributionID, service.Now())
		if err != nil {
			return err
		}
		inserted, err := result.RowsAffected()
		if err != nil || inserted == 0 {
			return err
		}
		updated, err := tx.BattleParticipant.Update().Where(battleparticipant.BattleID(battle.ID), battleparticipant.UserID(recipientID)).AddScore(charged.TotalCoins).Save(ctx)
		if err != nil {
			return err
		}
		if updated != 1 {
			return liveerrors.Api(409, "BATTLE_PARTICIPANT_INACTIVE", "The recipient is no longer an active participant.")
		}
		if err := tx.GiftContribution.Create().SetLiveID(battle.LiveID).SetScopeKey(battleScopeKey(battle.ID)).SetReceiverID(recipientID).SetSenderID(senderID).
			SetCoins(charged.TotalCoins).SetGiftCount(0).OnConflictColumns("live_id", "scope_key", "receiver_id", "sender_id").AddCoins(charged.TotalCoins).Exec(ctx); err != nil {
			return err
		}
		if err := tx.LiveSession.UpdateOneID(battle.LiveID).AddTotalCoins(charged.TotalCoins).AddCreatorCoins(charged.HoldingCoins).Exec(ctx); err != nil {
			return err
		}
		rows, err := service.loadParticipants(ctx, tx, battle.ID)
		if err != nil {
			return err
		}
		totals, err := totalGiftsByReceiverAndSender(ctx, tx.Client(), battle.LiveID, battle.ID)
		if err != nil {
			return err
		}
		scores := make([]FinalScore, 0, len(rows))
		topContributors := make(map[string][]events.GoalContributor, len(rows))
		for _, participant := range rows {
			scores = append(scores, FinalScore{UserId: participant.UserID.String(), Score: participant.Score})
			topContributors[participant.UserID.String()] = topContributorsForReceiver(totals, participant.UserID)
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.BattleScoreUpdated, battle.LiveID.String(), service.Now(), map[string]any{
			"liveId": battle.LiveID.String(), "battleId": battle.ID.String(), "scores": scores, "topGifters": topContributors,
			"coinContribution": map[string]any{"id": contributionID.String(), "senderUserId": senderID.String(), "recipientUserId": recipientID.String(), "coins": charged.TotalCoins},
		})
	})
}
