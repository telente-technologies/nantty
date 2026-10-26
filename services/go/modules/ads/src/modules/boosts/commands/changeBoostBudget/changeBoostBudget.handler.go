package changeboostbudget

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adboostchange"
	"nantty/modules/ads/src/modules/boosts/dtos"
	"nantty/modules/ads/src/modules/boosts/services"
	adsservices "nantty/modules/ads/src/services"
	"nantty/modules/ads/src/types"
	"nantty/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Quote(ctx context.Context, command Command) (dtos.BoostBudgetQuote, error) {
	deployed := handler.Container
	boost, err := services.RequireBoostOwner(ctx, deployed.Client, command.BoostId, command.UserId)
	if err != nil {
		return dtos.BoostBudgetQuote{}, err
	}
	plan, err := services.PlanBoostBudgetChange(boost, command.Request, handler.minimumDaily(ctx, boost.Audience, boost.Currency), deployed.Now())
	if err != nil {
		return dtos.BoostBudgetQuote{}, err
	}
	summary, err := services.ReadAdBalanceSummary(ctx, deployed, command.UserId, boost.Currency)
	if err != nil {
		return dtos.BoostBudgetQuote{}, err
	}
	money := func(amount int64) types.Money { return types.Money{AmountMinor: amount, Currency: boost.Currency} }
	quote := dtos.BoostBudgetQuote{AdditionalCost: money(plan.AdditionalMinor), NewDailyBudget: money(plan.NewDailyMinor), NewTotalBudget: money(plan.NewTotalMinor),
		NewDurationDays: plan.NewDurationDays, PaymentOptions: services.BuildBudgetChangePaymentOptions(summary)}
	if plan.NewEndsAt != nil {
		formatted := plan.NewEndsAt.UTC().Format(time.RFC3339)
		quote.NewEndsAt = &formatted
	}
	return quote, nil
}

func (handler Handler) minimumDaily(ctx context.Context, audience []byte, currency string) int64 {
	var parsed dtos.BoostAudience
	_ = json.Unmarshal(audience, &parsed)
	return handler.Container.Pricing.FloorsForCountries(ctx, services.BoostTargetCountries(parsed), currency).BoostMinimumDailyMinor
}

func hashChange(request dtos.BoostBudgetChangeRequest, boostId string) string {
	encoded, _ := json.Marshal(struct {
		BoostId string
		Request dtos.BoostBudgetChangeRequest
	}{boostId, request})
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:])
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.BoostBudgetChangeResult, error) {
	deployed := handler.Container
	method := command.Request.PaymentMethod
	if method != services.PaymentCard && method != services.PaymentAdBalance {
		return dtos.BoostBudgetChangeResult{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "paymentMethod", Message: "Pay for added budget by card or from your ad credit and balance."}})
	}
	hash := hashChange(command.Request, command.BoostId.String())
	if existing, err := deployed.Client.AdBoostChange.Query().Where(adboostchange.UserID(command.UserId), adboostchange.IdempotencyKey(command.IdempotencyKey)).Only(ctx); err == nil {
		if existing.RequestHash != hash {
			return dtos.BoostBudgetChangeResult{}, adserrors.IdempotencyKeyReused
		}
		return handler.present(ctx, command, existing)
	} else if !ent.IsNotFound(err) {
		return dtos.BoostBudgetChangeResult{}, err
	}
	var change *ent.AdBoostChange
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		boost, err := services.LoadOwnedBoostForUpdate(ctx, tx, command.BoostId, command.UserId)
		if err != nil {
			return err
		}
		now := deployed.Now()
		plan, err := services.PlanBoostBudgetChange(boost, command.Request, handler.minimumDaily(ctx, boost.Audience, boost.Currency), now)
		if err != nil {
			return err
		}
		paidNow := method == services.PaymentAdBalance || plan.AdditionalMinor == 0
		if method == services.PaymentAdBalance && plan.AdditionalMinor > 0 {
			account, err := tx.AdAccount.Query().Where(adaccount.ID(boost.AccountID)).ForUpdate().Only(ctx)
			if err != nil {
				return err
			}
			position, err := adsservices.ReadAdFundsPosition(ctx, tx.Client(), account, now)
			if err != nil {
				return err
			}
			if position.SpendableMinor < plan.AdditionalMinor {
				return adserrors.InsufficientAdBalance
			}
		}
		create := tx.AdBoostChange.Create().SetBoostID(boost.ID).SetUserID(command.UserId).SetIdempotencyKey(command.IdempotencyKey).SetRequestHash(hash).
			SetExtraDays(plan.ExtraDays).SetNewDailyBudgetMinor(plan.NewDailyMinor).SetAdditionalMinor(plan.AdditionalMinor).SetCurrency(boost.Currency).
			SetPaymentMethod(adboostchange.PaymentMethod(method))
		if paidNow {
			create.SetStatus(adboostchange.StatusApplied).SetAppliedAt(now)
		}
		if change, err = create.Save(ctx); err != nil {
			return err
		}
		if !paidNow {
			return nil
		}
		return services.ApplyBoostBudgetChangeInTransaction(ctx, tx, boost, plan.ExtraDays, plan.NewDailyMinor, plan.AdditionalMinor)
	})
	if ent.IsConstraintError(err) {
		existing, lookupErr := deployed.Client.AdBoostChange.Query().Where(adboostchange.UserID(command.UserId), adboostchange.IdempotencyKey(command.IdempotencyKey)).Only(ctx)
		if lookupErr != nil {
			return dtos.BoostBudgetChangeResult{}, err
		}
		if existing.RequestHash != hash {
			return dtos.BoostBudgetChangeResult{}, adserrors.IdempotencyKeyReused
		}
		change, err = existing, nil
	}
	if err != nil {
		return dtos.BoostBudgetChangeResult{}, err
	}
	return handler.present(ctx, command, change)
}

func (handler Handler) present(ctx context.Context, command Command, change *ent.AdBoostChange) (dtos.BoostBudgetChangeResult, error) {
	deployed := handler.Container
	result := dtos.BoostBudgetChangeResult{Change: dtos.BoostBudgetChange{Id: change.ID.String(), Status: string(change.Status), AdditionalCost: types.Money{AmountMinor: change.AdditionalMinor, Currency: change.Currency}}}
	if change.Status == adboostchange.StatusPendingPayment {
		checkoutUrl, err := handler.openCardCheckout(ctx, command, change)
		if err != nil {
			return dtos.BoostBudgetChangeResult{}, err
		}
		result.CheckoutUrl = &checkoutUrl
	}
	boost, err := deployed.Client.AdBoost.Get(ctx, change.BoostID)
	if err != nil {
		return dtos.BoostBudgetChangeResult{}, err
	}
	account, err := deployed.Client.AdAccount.Get(ctx, boost.AccountID)
	if err != nil {
		return dtos.BoostBudgetChangeResult{}, err
	}
	result.Boost, err = services.PresentBoost(ctx, deployed.Client, boost, adsservices.DayKeyInTimezone(deployed.Now(), account.Timezone), deployed.Now())
	return result, err
}
