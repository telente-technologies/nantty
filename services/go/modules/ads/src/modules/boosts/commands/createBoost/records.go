package createboost

import (
	"context"
	"encoding/json"
	"time"

	"zudomart/modules/ads/src/events"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adfundstransaction"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	campaignservices "zudomart/modules/ads/src/modules/campaigns/services"
	"zudomart/modules/ads/src/types"
)

func (handler Handler) ensureBoostAccount(ctx context.Context, command Command) (*ent.AdAccount, error) {
	currency := command.Request.DailyBudget.Currency
	existing, err := handler.Container.Client.AdAccount.Query().Where(adAccountOwnedBy(command.UserId, currency)).First(ctx)
	if err == nil {
		return existing, nil
	}
	if !ent.IsNotFound(err) {
		return nil, err
	}
	country := command.Country
	if len(country) != 2 {
		country = accountservices.CountryForCurrency(currency)
	}
	return handler.Container.Client.AdAccount.Create().SetName("Boosted posts").SetKind("personal").SetOwnerUserID(command.UserId).SetCountryCode(country).SetCurrency(currency).Save(ctx)
}

func (handler Handler) createRecords(ctx context.Context, tx *ent.Tx, command Command, account *ent.AdAccount, total int64, hash string) (*ent.AdBoost, error) {
	method := command.Request.PaymentMethod
	funded := method != "card"
	deployed, request, now := handler.Container, command.Request, handler.Container.Now()
	if err := ensureOwnerMembership(ctx, tx, account, command); err != nil {
		return nil, err
	}
	campaign, err := tx.AdCampaign.Create().SetAccountID(account.ID).SetName("Boost: " + request.PostId).SetObjective(adcampaign.Objective(services.ObjectiveForGoal(request.Goal))).SetKind(adcampaign.KindBoost).
		SetBudgetLevel(adcampaign.BudgetLevelCampaign).SetBudgetType(adcampaign.BudgetTypeDaily).SetBudgetAmountMinor(request.DailyBudget.AmountMinor).SetStartAt(now).SetEndAt(now.AddDate(0, 0, request.DurationDays)).SetCreatedByUserID(command.UserId).Save(ctx)
	if err != nil {
		return nil, err
	}
	group, err := tx.AdGroup.Create().SetAccountID(account.ID).SetCampaignID(campaign.ID).SetName("Boosted audience").SetAudience(services.AudienceForBoost(request.Audience, account.CountryCode)).
		SetPlacementMode(adgroup.PlacementModeManual).SetPlacements([]string{"feed"}).SetStartAt(now).SetEndAt(now.AddDate(0, 0, request.DurationDays)).SetBidType(adgroup.BidTypeAuto).Save(ctx)
	if err != nil {
		return nil, err
	}
	input := boostCreativeInput(request)
	stored := campaignservices.ResolveCreative(input, account, deployed.Settings.MediaBaseUrl)
	row, err := tx.Ad.Create().SetAccountID(account.ID).SetCampaignID(campaign.ID).SetAdGroupID(group.ID).SetName("Boosted post").SetFormat("feed_post").SetCreative(stored).Save(ctx)
	if err != nil {
		return nil, err
	}
	status := adboost.StatusPendingPayment
	if funded {
		status = adboost.StatusInReview
		if err := creditAccountForBoost(ctx, tx, account, total, request.DailyBudget.Currency, campaign.ID.String(), method == "free"); err != nil {
			return nil, err
		}
		if _, err := campaignservices.SubmitAdsForReviewInTransaction(ctx, tx, campaign.ID, now); err != nil {
			return nil, err
		}
	}
	audience, _ := json.Marshal(request.Audience)
	boost, err := tx.AdBoost.Create().SetUserID(command.UserId).SetPostID(request.PostId).SetGoal(adboost.Goal(request.Goal)).SetStatus(status).SetAudience(audience).SetCurrency(request.DailyBudget.Currency).
		SetDailyBudgetMinor(request.DailyBudget.AmountMinor).SetDurationDays(request.DurationDays).SetTotalBudgetMinor(total).SetPaymentMethod(adboost.PaymentMethod(request.PaymentMethod)).
		SetIdempotencyKey(command.IdempotencyKey).SetRequestHash(hash).SetAccountID(account.ID).SetCampaignID(campaign.ID).SetAdGroupID(group.ID).SetAdID(row.ID).Save(ctx)
	if err != nil {
		return nil, err
	}
	if method == "free" {
		if err := consumeFreeBoost(ctx, tx, boost, account.Timezone, now); err != nil {
			return nil, err
		}
	}
	return boost, events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdBoostCreated, boost.ID.String(), now, events.AdBoostCreatedEventData{
		BoostId: boost.ID.String(), UserId: command.UserId.String(), PostId: request.PostId, Goal: request.Goal, TotalBudgetMinor: total, Currency: request.DailyBudget.Currency, PaymentMethod: request.PaymentMethod,
	})
}

func creditAccountForBoost(ctx context.Context, tx *ent.Tx, account *ent.AdAccount, total int64, currency, reference string, free bool) error {
	if err := tx.AdAccount.UpdateOneID(account.ID).AddBalanceMinor(total).Exec(ctx); err != nil {
		return err
	}
	kind, description := adfundstransaction.TypeTopUp, "Post boost funding"
	if free {
		kind, description = adfundstransaction.TypeCreditGrant, "Free Premium boost"
	}
	return tx.AdFundsTransaction.Create().SetAccountID(account.ID).SetType(kind).SetAmountMinor(total).SetCurrency(currency).SetDescription(description).SetReference("boost:" + reference).Exec(ctx)
}

func consumeFreeBoost(ctx context.Context, tx *ent.Tx, boost *ent.AdBoost, timezone string, now time.Time) error {
	period, _ := services.FreeBoostPeriod(now, timezone)
	return tx.AdFreeBoostGrant.Create().SetUserID(boost.UserID).SetPeriodKey(period).SetBoostID(boost.ID).SetValueMinor(boost.TotalBudgetMinor).SetCurrency(boost.Currency).Exec(ctx)
}

func boostCreativeInput(request dtos.CreateBoostRequest) types.CreativeInput {
	destination := types.CreativeDestination{Type: "post", TargetId: &request.PostId}
	if request.Goal == "messages" {
		destination = types.CreativeDestination{Type: "messages"}
	}
	return types.CreativeInput{
		Format: "feed_post", Source: types.CreativeSource{Type: "post", Id: request.PostId}, MediaIds: []string{}, Headline: "Boosted post",
		CallToAction: services.CallToActionForGoal(request.Goal), Destination: destination,
	}
}
