package controllers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
	"net/http"
	"time"
)

// SendCoinGift never accepts a recipient or price; money resolves the host and catalog.
func (c SpacesController) SendCoinGift(w http.ResponseWriter, r *http.Request) {
	actor, err := utils.ActorFrom(r)
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	if !c.rateLimit(w, r, actor.UserId) {
		return
	}
	id, err := utils.PathIdentifier(r, "spaceId")
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	var input struct {
		GiftID   string `json:"giftId"`
		Quantity int    `json:"quantity"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input); err != nil || input.GiftID == "" || input.Quantity < 1 || input.Quantity > 100 {
		c.responder().Error(w, r, httpserver.NewApiError(422, "INVALID_GIFT", "Choose a gift and a quantity from 1 to 100."))
		return
	}
	row, err := c.Container.Client.Space.Get(r.Context(), id)
	if err == nil {
		err = c.authorizeSpaceAudience(r.Context(), row, actor.UserId)
	}
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	if row.HostID == actor.UserId || string(row.State) != "live" || !row.GiftsEnabled {
		c.responder().Error(w, r, httpserver.NewApiError(409, "SPACE_GIFT_UNAVAILABLE", "Gifts are available only to the host of a live Space."))
		return
	}
	if c.Container.Money == nil {
		c.responder().Error(w, r, httpserver.NewApiError(503, "MONEY_UNAVAILABLE", "Gifting is temporarily unavailable."))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	receipt, err := c.Container.Money.ChargeSpaceCoinGift(ctx, interfaces.ChargeSpaceCoinGiftRequest{SenderUserId: actor.UserId.String(), SpaceId: id.String(), GiftId: input.GiftID, Quantity: input.Quantity, IdempotencyKey: r.Header.Get("Idempotency-Key")})
	if err != nil {
		c.responder().Error(w, r, spaceGiftError(err))
		return
	}
	httpserver.WriteJsonResponse(w, 201, map[string]any{"id": receipt.GiftTransactionId, "hostUserId": receipt.HostUserId, "totalCoins": receipt.TotalCoins, "senderCoinBalance": receipt.SenderCoinBalance})
}

// SendCoinDonation accepts an amount only. The money service enforces the
// server-owned min/max policy and resolves the sole recipient from Space state.
func (c SpacesController) SendCoinDonation(w http.ResponseWriter, r *http.Request) {
	actor, err := utils.ActorFrom(r)
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	if !c.rateLimit(w, r, actor.UserId) {
		return
	}
	id, err := utils.PathIdentifier(r, "spaceId")
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	var input struct {
		Coins int64 `json:"coins"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		c.responder().Error(w, r, httpserver.NewApiError(http.StatusBadRequest, "INVALID_DONATION_REQUEST", "Send only a positive integer coins amount."))
		return
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		c.responder().Error(w, r, httpserver.NewApiError(http.StatusBadRequest, "INVALID_DONATION_REQUEST", "Send one JSON object containing only coins."))
		return
	}
	row, err := c.Container.Client.Space.Get(r.Context(), id)
	if err == nil {
		err = c.authorizeSpaceAudience(r.Context(), row, actor.UserId)
	}
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	if string(row.State) != "live" || !row.GiftsEnabled {
		c.responder().Error(w, r, httpserver.NewApiError(http.StatusConflict, "SPACE_DONATION_UNAVAILABLE", "Coin donations are available only to the host of a live Space that accepts donations."))
		return
	}
	if c.Container.Money == nil {
		c.responder().Error(w, r, httpserver.NewApiError(http.StatusServiceUnavailable, "MONEY_UNAVAILABLE", "Coin donations are temporarily unavailable."))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	receipt, err := c.Container.Money.DonateSpaceCoins(ctx, interfaces.DonateSpaceCoinsRequest{
		SenderUserId: actor.UserId.String(), SpaceId: id.String(), Coins: input.Coins, IdempotencyKey: r.Header.Get("Idempotency-Key"),
	})
	if err != nil {
		c.responder().Error(w, r, SpaceDonationError(err))
		return
	}
	httpserver.WriteJsonResponse(w, http.StatusCreated, map[string]any{
		"id": receipt.DonationId, "donationId": receipt.DonationId, "ledgerTransactionId": receipt.LedgerTransactionId,
		"senderUserId": receipt.SenderUserId, "hostUserId": receipt.HostUserId, "spaceId": receipt.SpaceId,
		"totalCoins": receipt.TotalCoins, "platformFeeCoins": receipt.PlatformFeeCoins, "creatorAmountCoins": receipt.CreatorAmountCoins,
		"senderCoinBalance": receipt.SenderCoinBalance, "replayed": receipt.Replayed,
	})
}

func SpaceDonationError(err error) error {
	var policy *interfaces.DonationAmountPolicyError
	switch {
	case errors.As(err, &policy):
		return httpserver.NewApiError(http.StatusUnprocessableEntity, "INVALID_DONATION_AMOUNT", "Choose a coin amount within the Space donation limits.").WithDetails(map[string]any{
			"minimumCoins": policy.MinimumCoins, "maximumCoins": policy.MaximumCoins,
		})
	case errors.Is(err, interfaces.ErrInsufficientCoins):
		return httpserver.NewApiError(http.StatusPaymentRequired, "INSUFFICIENT_COINS", "You do not have enough coins.")
	case errors.Is(err, interfaces.ErrIdempotencyKeyReused):
		return httpserver.NewApiError(http.StatusUnprocessableEntity, "IDEMPOTENCY_KEY_REUSED", "This donation attempt was already used for another amount.")
	case errors.Is(err, interfaces.ErrCannotGiftSelf), errors.Is(err, interfaces.ErrSpaceDonationBlocked):
		return httpserver.NewApiError(http.StatusForbidden, "SPACE_DONATION_UNAVAILABLE", "You cannot donate coins to this host.")
	case errors.Is(err, interfaces.ErrSpaceDonationUnavailable), errors.Is(err, interfaces.ErrSpaceDonationsDisabled), errors.Is(err, interfaces.ErrSpaceHostNotCreator):
		return httpserver.NewApiError(http.StatusConflict, "SPACE_DONATION_UNAVAILABLE", "This Space cannot receive coin donations.")
	default:
		return httpserver.NewApiError(http.StatusServiceUnavailable, "MONEY_UNAVAILABLE", "Coin donations are temporarily unavailable. Retry with the same idempotency key.")
	}
}

func spaceGiftError(err error) error {
	switch {
	case errors.Is(err, interfaces.ErrInsufficientCoins):
		return httpserver.NewApiError(402, "INSUFFICIENT_COINS", "You do not have enough coins.")
	case errors.Is(err, interfaces.ErrIdempotencyKeyReused):
		return httpserver.NewApiError(422, "IDEMPOTENCY_KEY_REUSED", "This gift attempt was already used for another request.")
	case errors.Is(err, interfaces.ErrCannotGiftSelf), errors.Is(err, interfaces.ErrSpaceGiftBlocked):
		return httpserver.NewApiError(403, "SPACE_GIFT_UNAVAILABLE", "You cannot send a gift to this host.")
	case errors.Is(err, interfaces.ErrSpaceGiftUnavailable), errors.Is(err, interfaces.ErrSpaceGiftsDisabled), errors.Is(err, interfaces.ErrSpaceHostNotCreator), errors.Is(err, interfaces.ErrRecipientCannotReceiveGifts):
		return httpserver.NewApiError(409, "SPACE_GIFT_UNAVAILABLE", "This Space cannot receive gifts.")
	case errors.Is(err, interfaces.ErrMoneyRequestInvalid):
		return httpserver.NewApiError(422, "INVALID_GIFT", "Choose an available gift.")
	default:
		return httpserver.NewApiError(503, "MONEY_UNAVAILABLE", "Gifting is temporarily unavailable. Retry this gift.")
	}
}
