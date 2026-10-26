package createboost

import (
	"context"
	"encoding/json"
	"time"

	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/events"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adboost"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/generated/ent/adcreditlot"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	"nantty/modules/ads/src/generated/ent/adgroup"
	"nantty/modules/ads/src/modules/boosts/services"
	campaignservices "nantty/modules/ads/src/modules/campaigns/services"
	adsservices "nantty/modules/ads/src/services"
)

func (handler Handler) ensureBoostAccount(ctx context.Context, command Command) (*ent.AdAccount, error) {
	return services.EnsurePersonalBoostAccount(ctx, handler.Container.Client, command.UserId, command.Request.DailyBudget.Currency, command.Country.CountryCode)
}

func (handler Handler) createRecords(ctx context.Context, tx *ent.Tx, command Command, account *ent.AdAccount, total int64, hash string) (*ent.AdBoost, error) {
	method := command.Request.PaymentMethod
	funded := method != "card"
	deployed, request, now := handler.Container, command.Request, handler.Container.Now()
	if err := ensureOwnerMembership(ctx, tx, account, command); err != nil {
		return nil, err
	}
	start, scheduled := scheduledStart(request.StartAt, now)
	end := start.AddDate(0, 0, request.DurationDays)
	budgetType, budgetAmount := adcampaign.BudgetTypeDaily, request.DailyBudget.AmountMinor
	if request.BudgetType == services.BudgetTypeTotal {
		budgetType, budgetAmount = adcampaign.BudgetTypeLifetime, total
	}
	if method == "ad_balance" {
		if err := requireSpendableAdFunds(ctx, tx, account, total, now); err != nil {
			return nil, err
		}
	}
	campaign, err := tx.AdCampaign.Create().SetAccountID(account.ID).SetName("Boost: " + services.BoostNoun(request.DestinationType) + " " + request.TargetId).SetObjective(adcampaign.Objective(services.ObjectiveForGoal(request.Goal))).SetKind(adcampaign.KindBoost).
		SetBudgetLevel(adcampaign.BudgetLevelCampaign).SetBudgetType(budgetType).SetBudgetAmountMinor(budgetAmount).SetStartAt(start).SetEndAt(end).SetCreatedByUserID(command.UserId).Save(ctx)
	if err != nil {
		return nil, err
	}
	group, err := tx.AdGroup.Create().SetAccountID(account.ID).SetCampaignID(campaign.ID).SetName("Boosted audience").SetAudience(services.AudienceForBoost(request.Audience, account.CountryCode)).
		SetPlacementMode(adgroup.PlacementModeManual).SetPlacements([]string{"feed"}).SetStartAt(start).SetEndAt(end).SetBidType(adgroup.BidTypeAuto).Save(ctx)
	if err != nil {
		return nil, err
	}
	input := services.BoostCreativeInput(request.BoostEstimateRequest)
	stored := campaignservices.ResolveCreative(input, account, deployed.Settings.MediaBaseUrl)
	row, err := tx.Ad.Create().SetAccountID(account.ID).SetCampaignID(campaign.ID).SetAdGroupID(group.ID).SetName(input.Headline).SetFormat(input.Format).SetCreative(stored).Save(ctx)
	if err != nil {
		return nil, err
	}
	status := adboost.StatusPendingPayment
	if funded {
		status = adboost.StatusInReview
		if method == "wallet" || method == "balance" {
			if err := creditAccountForBoost(ctx, tx, account, total, request.DailyBudget.Currency, campaign.ID.String()); err != nil {
				return nil, err
			}
		}
		if _, err := campaignservices.SubmitAdsForReviewInTransaction(ctx, tx, campaign.ID, now); err != nil {
			return nil, err
		}
	}
	audience, _ := json.Marshal(request.Audience)
	boost, err := tx.AdBoost.Create().SetUserID(command.UserId).SetPostID(request.TargetId).SetDestinationType(adboost.DestinationType(request.DestinationType)).SetGoal(adboost.Goal(request.Goal)).SetStatus(status).SetAudience(audience).SetCurrency(request.DailyBudget.Currency).
		SetDailyBudgetMinor(request.DailyBudget.AmountMinor).SetDurationDays(request.DurationDays).SetTotalBudgetMinor(total).SetPaymentMethod(adboost.PaymentMethod(request.PaymentMethod)).
		SetBudgetType(adboost.BudgetType(request.BudgetType)).SetNillableScheduledStartAt(scheduled).
		SetIdempotencyKey(command.IdempotencyKey).SetRequestHash(hash).SetAccountID(account.ID).SetCampaignID(campaign.ID).SetAdGroupID(group.ID).SetAdID(row.ID).Save(ctx)
	if err != nil {
		return nil, err
	}
	if method == "free" {
		if err := consumeFreeBoost(ctx, tx, boost, account.Timezone, now); err != nil {
			return nil, err
		}
		if err := issueFreeBoostCredit(ctx, tx, account, boost, now); err != nil {
			return nil, err
		}
	}
	return boost, events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdBoostCreated, boost.ID.String(), now, events.AdBoostCreatedEventData{
		BoostId: boost.ID.String(), UserId: command.UserId.String(), PostId: request.PostId, DestinationType: request.DestinationType, TargetId: request.TargetId, Goal: request.Goal, TotalBudgetMinor: total, Currency: request.DailyBudget.Currency, PaymentMethod: request.PaymentMethod,
	})
}

func creditAccountForBoost(ctx context.Context, tx *ent.Tx, account *ent.AdAccount, total int64, currency, reference string) error {
	if err := tx.AdAccount.UpdateOneID(account.ID).AddBalanceMinor(total).Exec(ctx); err != nil {
		return err
	}
	return tx.AdFundsTransaction.Create().SetAccountID(account.ID).SetType(adfundstransaction.TypeTopUp).SetAmountMinor(total).SetCurrency(currency).SetDescription("Boost paid from earnings").SetReference("boost:" + reference).Exec(ctx)
}

func issueFreeBoostCredit(ctx context.Context, tx *ent.Tx, account *ent.AdAccount, boost *ent.AdBoost, now time.Time) error {
	_, _, err := adsservices.IssueCreditLotInTransaction(ctx, tx, adsservices.CreditLotInput{
		AccountId: account.ID, UserId: boost.UserID, Currency: boost.Currency, Source: adcreditlot.SourcePremiumFreeBoost, AmountMinor: boost.TotalBudgetMinor,
		Reason: "Free Premium boost", Reference: "freeBoost:" + boost.ID.String(), BoostId: &boost.ID, Description: "Free Premium boost",
	}, now)
	return err
}

func scheduledStart(requested *string, now time.Time) (time.Time, *time.Time) {
	if requested == nil || *requested == "" {
		return now, nil
	}
	parsed, err := time.Parse(time.RFC3339, *requested)
	if err != nil || !parsed.After(now) {
		return now, nil
	}
	parsed = parsed.UTC()
	return parsed, &parsed
}

func requireSpendableAdFunds(ctx context.Context, tx *ent.Tx, account *ent.AdAccount, total int64, now time.Time) error {
	locked, err := tx.AdAccount.Query().Where(adaccount.ID(account.ID)).ForUpdate().Only(ctx)
	if err != nil {
		return err
	}
	position, err := adsservices.ReadAdFundsPosition(ctx, tx.Client(), locked, now)
	if err != nil {
		return err
	}
	if position.SpendableMinor < total {
		return adserrors.InsufficientAdBalance
	}
	return nil
}

func consumeFreeBoost(ctx context.Context, tx *ent.Tx, boost *ent.AdBoost, timezone string, now time.Time) error {
	period, _ := services.FreeBoostPeriod(now, timezone)
	return tx.AdFreeBoostGrant.Create().SetUserID(boost.UserID).SetPeriodKey(period).SetBoostID(boost.ID).SetValueMinor(boost.TotalBudgetMinor).SetCurrency(boost.Currency).Exec(ctx)
}
