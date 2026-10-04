package services

import (
	"context"
	"errors"
	"strconv"
	"time"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/interfaces"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	battlerecord "zudomart/modules/live/src/generated/ent/battle"
	"zudomart/modules/live/src/generated/ent/battleparticipant"
	"zudomart/modules/live/src/generated/ent/gift"
	"zudomart/modules/live/src/generated/ent/guestslot"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/generated/ent/processedgift"
	"zudomart/platform/httpserver"
)

const (
	comboWindow         = 3 * time.Second
	moneyCallTimeout    = 5 * time.Second
	minimumQuantity     = 1
	maximumGiftQuantity = 100
)

func (service *LiveService) SendGiftToLive(ctx context.Context, actor types.Actor, input types.SendGiftInput) (types.GiftReceipt, error) {
	if input.Quantity < minimumQuantity || input.Quantity > maximumGiftQuantity {
		return types.GiftReceipt{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "quantity", Message: "Choose between 1 and 100 gifts."}})
	}
	catalogGift, err := service.Client.Gift.Query().Where(gift.ID(input.GiftId), gift.IsActive(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.GiftReceipt{}, liveerrors.GiftNotFound
	}
	if err != nil {
		return types.GiftReceipt{}, err
	}
	session, receiverId, err := service.resolveGiftTarget(ctx, actor, input)
	if err != nil {
		return types.GiftReceipt{}, err
	}
	battleId, err := service.findBattleReceivingGift(ctx, session.ID, receiverId)
	if err != nil {
		return types.GiftReceipt{}, err
	}
	charged, err := service.chargeGift(ctx, actor, session, receiverId, catalogGift, input, battleId)
	if err != nil {
		return types.GiftReceipt{}, err
	}
	return service.recordCommittedGift(ctx, actor, session, receiverId, catalogGift, input, battleId, charged)
}

func (service *LiveService) resolveGiftTarget(ctx context.Context, actor types.Actor, input types.SendGiftInput) (*ent.LiveSession, uuid.UUID, error) {
	session, err := service.Client.LiveSession.Get(ctx, input.LiveId)
	if ent.IsNotFound(err) {
		return nil, uuid.Nil, liveerrors.LiveNotFound
	}
	if err != nil {
		return nil, uuid.Nil, err
	}
	if session.State != livesession.StateLive {
		return nil, uuid.Nil, liveerrors.LiveNotActive
	}
	if !session.GiftsEnabled {
		return nil, uuid.Nil, liveerrors.GiftsDisabled
	}
	receiverId := session.HostID
	if input.ReceiverUserId != nil {
		receiverId = *input.ReceiverUserId
	}
	if receiverId == actor.UserId {
		return nil, uuid.Nil, liveerrors.CannotGiftSelf
	}
	if receiverId != session.HostID {
		onStage, err := service.Client.GuestSlot.Query().Where(guestslot.LiveID(session.ID), guestslot.UserID(receiverId),
			guestslot.StateIn(guestslot.StateOnStage, guestslot.StateReconnecting)).Exist(ctx)
		if err != nil || !onStage {
			return nil, uuid.Nil, orRecipientNotOnStage(err)
		}
	}
	since := service.Now().Add(-time.Second)
	recent, err := service.Client.ProcessedGift.Query().Where(processedgift.SenderID(actor.UserId), processedgift.CreatedAtGT(since)).Count(ctx)
	if err != nil {
		return nil, uuid.Nil, err
	}
	if recent >= service.Settings.GiftPlatformBurstLimitPerSecond {
		return nil, uuid.Nil, liveerrors.GiftRateLimited
	}
	return session, receiverId, nil
}

func orRecipientNotOnStage(err error) error {
	if err != nil {
		return err
	}
	return liveerrors.RecipientNotOnStage
}

func (service *LiveService) findBattleReceivingGift(ctx context.Context, liveId, receiverId uuid.UUID) (*uuid.UUID, error) {
	now := service.Now()
	battle, err := service.Client.Battle.Query().Where(battlerecord.LiveID(liveId), battlerecord.StateEQ(battlerecord.StateActive),
		battlerecord.StartsAtLTE(now), battlerecord.EndsAtGT(now)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	taking, err := service.Client.BattleParticipant.Query().Where(battleparticipant.BattleID(battle.ID), battleparticipant.UserID(receiverId), battleparticipant.StateEQ(battleparticipant.StateActive)).Exist(ctx)
	if err != nil || !taking {
		return nil, err
	}
	return &battle.ID, nil
}

func (service *LiveService) chargeGift(ctx context.Context, actor types.Actor, session *ent.LiveSession, receiverId uuid.UUID, catalogGift *ent.Gift, input types.SendGiftInput, battleId *uuid.UUID) (interfaces.ChargedGift, error) {
	request := interfaces.ChargeGiftRequest{
		SenderUserId: actor.UserId.String(), ReceiverUserId: receiverId.String(), HostUserId: session.HostID.String(), LiveId: session.ID.String(),
		GiftId: catalogGift.ID, Quantity: input.Quantity, UnitPriceCoins: catalogGift.PriceCoins, IdempotencyKey: input.IdempotencyKey, ComboId: input.ComboId,
	}
	if battleId != nil {
		request.BattleId = battleId.String()
	}
	callContext, cancel := context.WithTimeout(ctx, moneyCallTimeout)
	defer cancel()
	charged, err := service.Money.ChargeGiftAndCreditCreator(callContext, request)
	switch {
	case err == nil:
		return charged, nil
	case errors.Is(err, interfaces.ErrInsufficientCoins):
		return interfaces.ChargedGift{}, service.buildInsufficientCoinsError(ctx, actor.UserId)
	case errors.Is(err, interfaces.ErrCannotGiftSelf):
		return interfaces.ChargedGift{}, liveerrors.CannotGiftSelf
	case errors.Is(err, interfaces.ErrRecipientCannotReceiveGifts):
		return interfaces.ChargedGift{}, liveerrors.Api(409, "RECIPIENT_CANNOT_RECEIVE_GIFTS", "Neither the recipient nor the host can receive gifts yet.")
	case errors.Is(err, interfaces.ErrIdempotencyKeyReused):
		return interfaces.ChargedGift{}, liveerrors.Unprocessable("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was used with a different request.")
	}
	service.Logger.WarnContext(ctx, "gift charge failed", "error", err)
	return interfaces.ChargedGift{}, liveerrors.Api(502, "MONEY_UNAVAILABLE", "Gifting is unavailable right now. Try again.")
}

func (service *LiveService) buildInsufficientCoinsError(ctx context.Context, userId uuid.UUID) error {
	apiFailure := liveerrors.Api(402, "INSUFFICIENT_COINS", "You do not have enough coins.")
	if balance, err := service.Money.GetCoinBalance(ctx, userId.String()); err == nil {
		apiFailure.Issues = []httpserver.ValidationIssue{{Path: "coinBalance", Message: strconv.FormatInt(balance, 10)}}
	}
	return apiFailure
}
