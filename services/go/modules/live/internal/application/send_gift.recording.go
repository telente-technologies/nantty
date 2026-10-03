package application

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/giftcombo"
	"zudomart/modules/live/internal/ent/processedgift"
	"zudomart/modules/live/internal/ports"
)

type committedGift struct {
	Id                 uuid.UUID
	LiveId             uuid.UUID
	SenderId           uuid.UUID
	ReceiverId         uuid.UUID
	BattleId           *uuid.UUID
	GiftId             string
	Quantity           int
	TotalCoins         int64
	CreatorAmountCoins int64
	ComboId            string
	ComboCount         int
	CreatedAt          time.Time
}

func (application *LiveApplication) recordCommittedGift(ctx context.Context, actor Actor, session *ent.LiveSession, receiverId uuid.UUID, catalogGift *ent.Gift, input SendGiftInput, battleId *uuid.UUID, charged ports.ChargedGift) (GiftReceipt, error) {
	transactionId, err := uuid.Parse(charged.GiftTransactionId)
	if err != nil {
		return GiftReceipt{}, apiError(502, "MONEY_UNAVAILABLE", "Gifting returned an invalid receipt.")
	}
	participants, err := application.lookupParticipants(ctx, actor.UserId)
	if err != nil {
		return GiftReceipt{}, err
	}
	sender := participants[actor.UserId]
	comboId := input.ComboId
	if comboId == "" {
		comboId = "cmb_" + uuid.NewString()[:8]
	}
	gift := committedGift{
		Id: transactionId, LiveId: session.ID, SenderId: actor.UserId, ReceiverId: receiverId, BattleId: battleId, GiftId: catalogGift.ID, Quantity: input.Quantity,
		TotalCoins: charged.TotalCoins, CreatorAmountCoins: charged.CreatorAmountCoins, ComboId: comboId, CreatedAt: charged.CreatedAt,
	}
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		if gift.ComboCount, err = application.advanceCombo(ctx, tx, gift, input.IdempotencyKey, charged.Replayed); err != nil {
			return err
		}
		inserted, err := tx.ProcessedGift.Create().SetID(transactionId).SetSenderID(actor.UserId).OnConflictColumns(processedgift.FieldID).DoNothing().ID(ctx)
		if err != nil || inserted == uuid.Nil {
			return ignoreAlreadyProcessed(err)
		}
		return application.applyGiftEffects(ctx, tx, session, gift, catalogGift, sender)
	})
	if err != nil {
		return GiftReceipt{}, err
	}
	return GiftReceipt{
		GiftTransactionId: transactionId.String(), GiftId: gift.GiftId, Quantity: gift.Quantity, TotalCoins: gift.TotalCoins, ReceiverUserId: receiverId.String(),
		ComboId: comboId, ComboCount: gift.ComboCount, CoinBalance: charged.SenderCoinBalance, BattleId: formatOptionalUuid(battleId), CreatedAt: formatTime(gift.CreatedAt),
	}, nil
}

func ignoreAlreadyProcessed(err error) error {
	if err != nil && !ent.IsNotFound(err) && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	return nil
}

func (application *LiveApplication) advanceCombo(ctx context.Context, tx *ent.Tx, gift committedGift, idempotencyKey string, replayed bool) (int, error) {
	existing, err := tx.GiftCombo.Query().Where(giftcombo.SenderID(gift.SenderId), giftcombo.LiveID(gift.LiveId), giftcombo.ComboID(gift.ComboId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		err = tx.GiftCombo.Create().SetSenderID(gift.SenderId).SetLiveID(gift.LiveId).SetComboID(gift.ComboId).SetGiftID(gift.GiftId).SetReceiverID(gift.ReceiverId).
			SetCount(gift.Quantity).SetLastIdempotencyKey(idempotencyKey).SetLastAt(gift.CreatedAt).Exec(ctx)
		return gift.Quantity, err
	}
	if err != nil {
		return 0, err
	}
	if replayed || existing.LastIdempotencyKey == idempotencyKey {
		return existing.Count, nil
	}
	count := gift.Quantity
	if existing.GiftID == gift.GiftId && existing.ReceiverID == gift.ReceiverId && gift.CreatedAt.Sub(existing.LastAt) < comboWindow {
		count += existing.Count
	}
	err = existing.Update().SetGiftID(gift.GiftId).SetReceiverID(gift.ReceiverId).SetCount(count).SetLastIdempotencyKey(idempotencyKey).SetLastAt(gift.CreatedAt).Exec(ctx)
	return count, err
}
