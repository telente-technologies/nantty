package createboost

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	"zudomart/modules/ads/src/modules/boosts/validators"
	adsservices "zudomart/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.CreatedBoost, error) {
	deployed := handler.Container
	if command.Request.DailyBudget.Currency != command.Country.Currency {
		return dtos.CreatedBoost{}, adserrors.BoostCurrencyNotAllowed
	}
	floors := deployed.Pricing.FloorsForCountries(ctx, services.BoostTargetCountries(command.Request.Audience), command.Request.DailyBudget.Currency)
	if err := validators.ValidateCreate(command.Request, floors.BoostMinimumDailyMinor); err != nil {
		return dtos.CreatedBoost{}, err
	}
	hash := hashRequest(command.Request)
	if existing, found, err := handler.findExisting(ctx, command, hash); found || err != nil {
		return handler.present(ctx, command, existing, err)
	}
	total := command.Request.DailyBudget.AmountMinor * int64(command.Request.DurationDays)
	method := command.Request.PaymentMethod
	if err := handler.checkPaymentMethod(ctx, command, total, floors.BoostMinimumDailyMinor); err != nil {
		return dtos.CreatedBoost{}, err
	}
	account, err := handler.ensureBoostAccount(ctx, command)
	if err != nil {
		return dtos.CreatedBoost{}, err
	}
	charged := method == "wallet" || method == "balance"
	if charged {
		charge := deployed.Funding.ChargeUserWalletForBoost
		if method == "balance" {
			charge = deployed.Funding.ChargeEarningsForBoost
		}
		if err := charge(ctx, command.UserId.String(), account.Currency, total, command.IdempotencyKey); err != nil {
			return dtos.CreatedBoost{}, err
		}
	}
	var created *ent.AdBoost
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		created, err = handler.createRecords(ctx, tx, command, account, total, hash)
		return err
	})
	if err != nil && charged && !ent.IsConstraintError(err) {
		if refundErr := deployed.Funding.RefundBoostCharge(ctx, command.UserId.String(), account.Currency, total, "refund-"+command.IdempotencyKey, command.IdempotencyKey); refundErr != nil {
			deployed.Logger.Error("boost charge could not be refunded after the boost failed to save", slog.String("idempotencyKey", command.IdempotencyKey), slog.Any("error", refundErr))
		}
	}
	if ent.IsConstraintError(err) {
		existing, found, lookupErr := handler.findExisting(ctx, command, hash)
		if found || lookupErr != nil {
			return handler.present(ctx, command, existing, lookupErr)
		}
		if method == "free" {
			return dtos.CreatedBoost{}, adserrors.FreeBoostUsed
		}
	}
	return handler.present(ctx, command, created, err)
}

func (handler Handler) checkPaymentMethod(ctx context.Context, command Command, total, freeCap int64) error {
	deployed, method := handler.Container, command.Request.PaymentMethod
	if (method == "balance" || method == "wallet") && services.IsNativeClient(command.Platform) {
		return adserrors.PaymentNotAvailableInApp
	}
	switch method {
	case "balance":
		return adsservices.RequirePayoutVerified(ctx, deployed.Verification, command.UserId.String())
	case "free":
		premium, err := deployed.Entitlements.IsPremium(ctx, command.UserId.String())
		if err != nil {
			return adserrors.UpstreamUnavailable
		}
		if !premium {
			return adserrors.FreeBoostNotAvailable
		}
		if total > freeCap {
			return adserrors.FreeBoostTooLarge
		}
		state, err := services.ReadFreeBoost(ctx, deployed, command.UserId, true, freeBoostCap(freeCap, command))
		if err != nil {
			return err
		}
		if !state.Eligible {
			return adserrors.FreeBoostUsed
		}
	}
	return nil
}

func hashRequest(request dtos.CreateBoostRequest) string {
	encoded, _ := json.Marshal(request)
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:])
}

func (handler Handler) findExisting(ctx context.Context, command Command, hash string) (*ent.AdBoost, bool, error) {
	row, err := handler.Container.Client.AdBoost.Query().Where(adboost.UserID(command.UserId), adboost.IdempotencyKey(command.IdempotencyKey)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	if row.RequestHash != hash {
		return nil, true, adserrors.IdempotencyKeyReused
	}
	return row, true, nil
}

func (handler Handler) present(ctx context.Context, command Command, row *ent.AdBoost, err error) (dtos.CreatedBoost, error) {
	if err != nil || row == nil {
		return dtos.CreatedBoost{}, err
	}
	account, err := handler.Container.Client.AdAccount.Get(ctx, row.AccountID)
	if err != nil {
		return dtos.CreatedBoost{}, err
	}
	created := dtos.CreatedBoost{}
	if row.PaymentMethod == adboost.PaymentMethodCard && row.Status == adboost.StatusPendingPayment {
		checkoutUrl, err := handler.openCardCheckout(ctx, command, row, account)
		if err != nil {
			return dtos.CreatedBoost{}, err
		}
		created.CheckoutUrl = &checkoutUrl
	}
	created.Boost, err = services.PresentBoost(ctx, handler.Container.Client, row, adsservices.DayKeyInTimezone(handler.Container.Now(), account.Timezone))
	return created, err
}
