package services

import (
	"context"
	"database/sql"
	"maps"

	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptioncoveredprofile"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"zudomart/modules/subscriptions/src/models"
)

var grantedCoverageStatuses = []subscriptioncoveredprofile.Status{subscriptioncoveredprofile.StatusActive, subscriptioncoveredprofile.StatusRemoving}

func coveredProfileEntitlementData(data map[string]any, profileId string) map[string]any {
	copied := maps.Clone(data)
	copied["profileId"], copied["profileType"], copied["checkmark"], copied["combinedPlan"] = profileId, constants.ProfileBusiness, "gold", true
	return copied
}

func (billing Billing) enqueueCoveredEntitlementInTransaction(ctx context.Context, transaction *sql.Tx, eventType, profileId string, data map[string]any) error {
	return billing.Container.Outbox.EnqueueInTransaction(ctx, transaction, eventType, profileId, billing.Container.Now().UTC(), coveredProfileEntitlementData(data, profileId))
}

func (billing Billing) emitCombinedGoldEntitlementsInTransaction(ctx context.Context, transaction *sql.Tx, eventType string, data map[string]any) error {
	subscriptionId, _ := data["subscriptionId"].(string)
	client := billing.Container.Client(transaction)
	rows, err := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.SubscriptionID(subscriptionId), subscriptioncoveredprofile.StatusIn(grantedCoverageStatuses...)).
		Order(ent.Asc(subscriptioncoveredprofile.FieldCreatedAt)).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range rows {
		if err := billing.enqueueCoveredEntitlementInTransaction(ctx, transaction, eventType, row.ProfileID, data); err != nil {
			return err
		}
	}
	if eventType != "entitlement.revoked" {
		return nil
	}
	return client.SubscriptionCoveredProfile.Update().Where(subscriptioncoveredprofile.SubscriptionID(subscriptionId), subscriptioncoveredprofile.StatusIn(liveCoverageStatuses...)).
		SetStatus(subscriptioncoveredprofile.StatusRemoved).SetEndedAt(billing.Container.Now().UTC()).Exec(ctx)
}

func (billing Billing) settleCombinedGoldCoverageInTransaction(ctx context.Context, transaction *sql.Tx, row *ent.Subscription, period *ent.SubscriptionPeriod, paymentReference string) error {
	client := billing.Container.Client(transaction)
	now := billing.Container.Now().UTC()
	coverage := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()))
	activating, err := coverage.Clone().Where(subscriptioncoveredprofile.StatusEQ(subscriptioncoveredprofile.StatusPending), subscriptioncoveredprofile.ActivatesWithPeriodID(period.ID.String())).
		Order(ent.Asc(subscriptioncoveredprofile.FieldCreatedAt)).All(ctx)
	if err != nil {
		return err
	}
	if period.Kind == subscriptionperiod.KindUpgrade {
		shares := models.AllocateEvenly(period.AmountDueMinor, len(activating))
		for index, covered := range activating {
			if err := covered.Update().SetStatus(subscriptioncoveredprofile.StatusActive).SetActivatedAt(now).SetShareMinor(shares[index]).SetSharePaymentReference(paymentReference).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	}
	ending, err := coverage.Clone().Where(subscriptioncoveredprofile.StatusEQ(subscriptioncoveredprofile.StatusRemoving)).All(ctx)
	if err != nil {
		return err
	}
	data := entitlementData(row, "removed")
	for _, covered := range ending {
		if err := covered.Update().SetStatus(subscriptioncoveredprofile.StatusRemoved).SetEndedAt(now).Exec(ctx); err != nil {
			return err
		}
		if err := billing.enqueueCoveredEntitlementInTransaction(ctx, transaction, "entitlement.revoked", covered.ProfileID, data); err != nil {
			return err
		}
	}
	for _, covered := range activating {
		if err := covered.Update().SetStatus(subscriptioncoveredprofile.StatusActive).SetActivatedAt(now).Exec(ctx); err != nil {
			return err
		}
	}
	active, err := coverage.Clone().Where(subscriptioncoveredprofile.StatusEQ(subscriptioncoveredprofile.StatusActive)).Order(ent.Asc(subscriptioncoveredprofile.FieldCreatedAt)).All(ctx)
	if err != nil {
		return err
	}
	shares := models.AllocateEvenly(period.AmountDueMinor, len(active))
	for index, covered := range active {
		if err := covered.Update().SetShareMinor(shares[index]).SetSharePaymentReference(paymentReference).SetRefundState("").Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (billing Billing) countRenewingCoverageInTransaction(ctx context.Context, client *ent.Client, subscriptionId string) (int, error) {
	return client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.SubscriptionID(subscriptionId), subscriptioncoveredprofile.StatusEQ(subscriptioncoveredprofile.StatusActive)).Count(ctx)
}

func (billing Billing) cancelCombinedGoldWhenNothingRenewsInTransaction(ctx context.Context, client *ent.Client, row *ent.Subscription) error {
	renewing, err := billing.countRenewingCoverageInTransaction(ctx, client, row.ID.String())
	if err != nil || renewing > 0 {
		return err
	}
	pending, err := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()), subscriptioncoveredprofile.StatusEQ(subscriptioncoveredprofile.StatusPending)).Exist(ctx)
	if err != nil || pending {
		return err
	}
	return client.Subscription.UpdateOneID(row.ID).SetCancelAtPeriodEnd(true).Exec(ctx)
}

func (billing Billing) planCombinedGoldNextPeriod(ctx context.Context, client *ent.Client, row *ent.Subscription, interval string) (NextPeriodPlan, error) {
	count, err := billing.countRenewingCoverageInTransaction(ctx, client, row.ID.String())
	if err != nil {
		return NextPeriodPlan{}, err
	}
	if count == 0 {
		return NextPeriodPlan{}, ErrCombinedGoldProfilesInvalid
	}
	premium, err := billing.ownerHasLivePremium(ctx, client, row.OwnerUserID)
	if err != nil {
		return NextPeriodPlan{}, err
	}
	profile, _, err := billing.Container.Identity.FindProfile(ctx, row.ProfileID)
	if err != nil {
		return NextPeriodPlan{}, err
	}
	country := firstNonEmpty(profile.CountryCode, billing.Container.Settings.DefaultCountry)
	quote, regional, err := billing.priceCombinedGold(ctx, client, row.OwnerUserID, count, interval, country, premium)
	if err != nil {
		return NextPeriodPlan{}, err
	}
	if regional.NotChargeableOnWeb {
		return NextPeriodPlan{}, ErrWebCurrencyDisabled
	}
	price := quote.AsPriceQuote()
	if terms := row.OfferTerms; row.OfferCyclesRemaining > 0 && terms.PlanCode == constants.PlanGoldCombined {
		price, _ = models.ApplyOfferWhenItBeatsTheQuote(price, terms, regional.Currency)
	}
	credit := row.CreditMinor
	if row.Currency != regional.Currency {
		credit = 0
	}
	return NextPeriodPlan{
		PlanCode: constants.PlanGoldCombined, Interval: interval, Currency: regional.Currency, PeriodPriceMinor: price.ListAmountMinor, BookPriceMinor: price.ListAmountMinor,
		BillingNote: webBillingNote(regional), Charge: models.CombinedGoldCharge(quote, price, credit),
	}, nil
}

func (billing Billing) liveCombinedGoldOf(ctx context.Context, client *ent.Client, ownerUserId string) (*ent.Subscription, error) {
	row, err := client.Subscription.Query().Where(subscription.OwnerUserID(ownerUserId), subscription.PlanCode(constants.PlanGoldCombined), subscription.StatusIn(liveStatuses()...)).
		Order(ent.Desc(subscription.FieldCreatedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}
