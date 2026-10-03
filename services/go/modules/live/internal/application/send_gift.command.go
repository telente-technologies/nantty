package application

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ent/battleparticipant"
	"zudomart/modules/live/internal/ent/gift"
	"zudomart/modules/live/internal/ent/guestslot"
	"zudomart/modules/live/internal/ent/livesession"
	"zudomart/modules/live/internal/ent/processedgift"
	"zudomart/modules/live/internal/ports"
	"zudomart/platform/httpserver"
)

const (
	comboWindow         = 3 * time.Second
	moneyCallTimeout    = 5 * time.Second
	minimumQuantity     = 1
	maximumGiftQuantity = 100
)

type SendGiftInput struct {
	LiveId         uuid.UUID
	GiftId         string
	Quantity       int
	ReceiverUserId *uuid.UUID
	ComboId        string
	IdempotencyKey string
}

type GiftReceipt struct {
	GiftTransactionId string  `json:"giftTransactionId"`
	GiftId            string  `json:"giftId"`
	Quantity          int     `json:"quantity"`
	TotalCoins        int64   `json:"totalCoins"`
	ReceiverUserId    string  `json:"receiverUserId"`
	ComboId           string  `json:"comboId"`
	ComboCount        int     `json:"comboCount"`
	CoinBalance       int64   `json:"coinBalance"`
	BattleId          *string `json:"battleId"`
	CreatedAt         string  `json:"createdAt"`
}

func (application *LiveApplication) SendGiftToLive(ctx context.Context, actor Actor, input SendGiftInput) (GiftReceipt, error) {
	if input.Quantity < minimumQuantity || input.Quantity > maximumGiftQuantity {
		return GiftReceipt{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "quantity", Message: "Choose between 1 and 100 gifts."}})
	}
	catalogGift, err := application.Client.Gift.Query().Where(gift.ID(input.GiftId), gift.IsActive(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return GiftReceipt{}, errGiftNotFound
	}
	if err != nil {
		return GiftReceipt{}, err
	}
	session, receiverId, err := application.resolveGiftTarget(ctx, actor, input)
	if err != nil {
		return GiftReceipt{}, err
	}
	battleId, err := application.findBattleReceivingGift(ctx, session.ID, receiverId)
	if err != nil {
		return GiftReceipt{}, err
	}
	charged, err := application.chargeGift(ctx, actor, session, receiverId, catalogGift, input, battleId)
	if err != nil {
		return GiftReceipt{}, err
	}
	return application.recordCommittedGift(ctx, actor, session, receiverId, catalogGift, input, battleId, charged)
}

func (application *LiveApplication) resolveGiftTarget(ctx context.Context, actor Actor, input SendGiftInput) (*ent.LiveSession, uuid.UUID, error) {
	session, err := application.Client.LiveSession.Get(ctx, input.LiveId)
	if ent.IsNotFound(err) {
		return nil, uuid.Nil, errLiveNotFound
	}
	if err != nil {
		return nil, uuid.Nil, err
	}
	if session.State != livesession.StateLive {
		return nil, uuid.Nil, errLiveNotActive
	}
	if !session.GiftsEnabled {
		return nil, uuid.Nil, errGiftsDisabled
	}
	receiverId := session.HostID
	if input.ReceiverUserId != nil {
		receiverId = *input.ReceiverUserId
	}
	if receiverId == actor.UserId {
		return nil, uuid.Nil, errCannotGiftSelf
	}
	if receiverId != session.HostID {
		onStage, err := application.Client.GuestSlot.Query().Where(guestslot.LiveID(session.ID), guestslot.UserID(receiverId),
			guestslot.StateIn(guestslot.StateOnStage, guestslot.StateReconnecting)).Exist(ctx)
		if err != nil || !onStage {
			return nil, uuid.Nil, orRecipientNotOnStage(err)
		}
	}
	since := application.Now().Add(-time.Second)
	recent, err := application.Client.ProcessedGift.Query().Where(processedgift.SenderID(actor.UserId), processedgift.CreatedAtGT(since)).Count(ctx)
	if err != nil {
		return nil, uuid.Nil, err
	}
	if recent >= application.Settings.GiftPlatformBurstLimitPerSecond {
		return nil, uuid.Nil, errGiftRateLimited
	}
	return session, receiverId, nil
}

func orRecipientNotOnStage(err error) error {
	if err != nil {
		return err
	}
	return errRecipientNotOnStage
}

func (application *LiveApplication) findBattleReceivingGift(ctx context.Context, liveId, receiverId uuid.UUID) (*uuid.UUID, error) {
	now := application.Now()
	battle, err := application.Client.Battle.Query().Where(battlerecord.LiveID(liveId), battlerecord.StateEQ(battlerecord.StateActive),
		battlerecord.StartsAtLTE(now), battlerecord.EndsAtGT(now)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	taking, err := application.Client.BattleParticipant.Query().Where(battleparticipant.BattleID(battle.ID), battleparticipant.UserID(receiverId), battleparticipant.StateEQ(battleparticipant.StateActive)).Exist(ctx)
	if err != nil || !taking {
		return nil, err
	}
	return &battle.ID, nil
}

func (application *LiveApplication) chargeGift(ctx context.Context, actor Actor, session *ent.LiveSession, receiverId uuid.UUID, catalogGift *ent.Gift, input SendGiftInput, battleId *uuid.UUID) (ports.ChargedGift, error) {
	request := ports.ChargeGiftRequest{
		SenderUserId: actor.UserId.String(), ReceiverUserId: receiverId.String(), HostUserId: session.HostID.String(), LiveId: session.ID.String(),
		GiftId: catalogGift.ID, Quantity: input.Quantity, UnitPriceCoins: catalogGift.PriceCoins, IdempotencyKey: input.IdempotencyKey, ComboId: input.ComboId,
	}
	if battleId != nil {
		request.BattleId = battleId.String()
	}
	callContext, cancel := context.WithTimeout(ctx, moneyCallTimeout)
	defer cancel()
	charged, err := application.Money.ChargeGiftAndCreditCreator(callContext, request)
	switch {
	case err == nil:
		return charged, nil
	case errors.Is(err, ports.ErrInsufficientCoins):
		return ports.ChargedGift{}, application.buildInsufficientCoinsError(ctx, actor.UserId)
	case errors.Is(err, ports.ErrCannotGiftSelf):
		return ports.ChargedGift{}, errCannotGiftSelf
	case errors.Is(err, ports.ErrIdempotencyKeyReused):
		return ports.ChargedGift{}, unprocessable("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was used with a different request.")
	}
	application.Logger.WarnContext(ctx, "gift charge failed", "error", err)
	return ports.ChargedGift{}, apiError(502, "MONEY_UNAVAILABLE", "Gifting is unavailable right now. Try again.")
}

func (application *LiveApplication) buildInsufficientCoinsError(ctx context.Context, userId uuid.UUID) error {
	apiFailure := apiError(402, "INSUFFICIENT_COINS", "You do not have enough coins.")
	if balance, err := application.Money.GetCoinBalance(ctx, userId.String()); err == nil {
		apiFailure.Issues = []httpserver.ValidationIssue{{Path: "coinBalance", Message: strconv.FormatInt(balance, 10)}}
	}
	return apiFailure
}
