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
	floors := deployed.Pricing.FloorsForCountries(ctx, services.BoostTargetCountries(command.Request.Audience), command.Request.DailyBudget.Currency)
	if err := validators.ValidateCreate(command.Request, floors.BoostMinimumDailyMinor); err != nil {
		return dtos.CreatedBoost{}, err
	}
	hash := hashRequest(command.Request)
	if existing, found, err := handler.findExisting(ctx, command, hash); found || err != nil {
		return handler.present(ctx, existing, err)
	}
	account, err := handler.ensureBoostAccount(ctx, command)
	if err != nil {
		return dtos.CreatedBoost{}, err
	}
	total := command.Request.DailyBudget.AmountMinor * int64(command.Request.DurationDays)
	paid := command.Request.PaymentMethod == "wallet"
	if paid {
		if err := deployed.Funding.ChargeUserWalletForBoost(ctx, command.UserId.String(), account.Currency, total, command.IdempotencyKey); err != nil {
			return dtos.CreatedBoost{}, err
		}
	}
	var created *ent.AdBoost
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		created, err = handler.createRecords(ctx, tx, command, account, total, hash, paid)
		return err
	})
	if err != nil && paid && !ent.IsConstraintError(err) {
		if refundErr := deployed.Funding.RefundBoostCharge(ctx, command.UserId.String(), account.Currency, total, "refund-"+command.IdempotencyKey, command.IdempotencyKey); refundErr != nil {
			deployed.Logger.Error("boost charge could not be refunded after the boost failed to save", slog.String("idempotencyKey", command.IdempotencyKey), slog.Any("error", refundErr))
		}
	}
	if ent.IsConstraintError(err) {
		existing, found, lookupErr := handler.findExisting(ctx, command, hash)
		if found || lookupErr != nil {
			return handler.present(ctx, existing, lookupErr)
		}
	}
	return handler.present(ctx, created, err)
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

func (handler Handler) present(ctx context.Context, row *ent.AdBoost, err error) (dtos.CreatedBoost, error) {
	if err != nil || row == nil {
		return dtos.CreatedBoost{}, err
	}
	account, err := handler.Container.Client.AdAccount.Get(ctx, row.AccountID)
	if err != nil {
		return dtos.CreatedBoost{}, err
	}
	boost, err := services.PresentBoost(ctx, handler.Container.Client, row, adsservices.DayKeyInTimezone(handler.Container.Now(), account.Timezone))
	return dtos.CreatedBoost{Boost: boost}, err
}
