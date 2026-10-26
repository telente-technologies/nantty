package services

import (
	"context"
	"database/sql"
	"slices"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptioncoveredprofile"
	"nantty/modules/subscriptions/src/models"
	"nantty/modules/subscriptions/src/repositories"
)

type CombinedGoldCheckoutRequest struct {
	Checkout           CheckoutRequest
	ProfileIds         []string
	ExpectedTotalMinor *int64
}

func claimedStatuses() []subscription.Status {
	return append(liveStatuses(), subscription.StatusPending, subscription.StatusAwaitingCard)
}

var liveCoverageStatuses = []subscriptioncoveredprofile.Status{subscriptioncoveredprofile.StatusPending, subscriptioncoveredprofile.StatusActive, subscriptioncoveredprofile.StatusRemoving}

func lockGoldProfilesInTransaction(ctx context.Context, transaction *sql.Tx, profileIds []string) error {
	for _, profileId := range sortedCopy(profileIds) {
		if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 11))", "gold-profile:"+profileId); err != nil {
			return err
		}
	}
	return nil
}

func (billing Billing) refuseProfilesWithOwnGoldInTransaction(ctx context.Context, client *ent.Client, profileIds []string) error {
	goldPlans := []string{}
	for code, definition := range constants.Plans {
		if definition.Checkmark == "gold" && code != constants.PlanGoldCombined {
			goldPlans = append(goldPlans, code)
		}
	}
	owned, err := client.Subscription.Query().Where(subscription.ProfileIDIn(profileIds...), subscription.PlanCodeIn(goldPlans...), subscription.StatusIn(claimedStatuses()...)).Exist(ctx)
	if err != nil || !owned {
		return err
	}
	return ErrCombinedGoldProfileHasGold
}

func (billing Billing) refuseProfileCoveredByCombinedGoldInTransaction(ctx context.Context, client *ent.Client, profileId string) error {
	covered, err := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.ProfileID(profileId), subscriptioncoveredprofile.StatusIn(liveCoverageStatuses...)).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range covered {
		live, err := client.Subscription.Query().Where(subscription.ID(mustParseUuid(row.SubscriptionID)), subscription.StatusIn(claimedStatuses()...)).Exist(ctx)
		if err != nil {
			return err
		}
		if live {
			return ErrProfileCoveredByCombinedGold
		}
	}
	return nil
}

func (billing Billing) releaseAbandonedCombinedCheckoutsInTransaction(ctx context.Context, client *ent.Client, ownerUserId string, profileIds []string) error {
	pending, err := client.Subscription.Query().Where(subscription.OwnerUserID(ownerUserId), subscription.PlanCode(constants.PlanGoldCombined), subscription.StatusEQ(subscription.StatusPending)).IDs(ctx)
	if err != nil {
		return err
	}
	stale := make([]string, 0, len(pending))
	for _, id := range pending {
		stale = append(stale, id.String())
	}
	if len(stale) > 0 {
		if err := client.Subscription.Update().Where(subscription.IDIn(pending...)).SetStatus(subscription.StatusCanceled).SetLastError("Replaced by a newer checkout.").Exec(ctx); err != nil {
			return err
		}
	}
	orphaned, err := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.ProfileIDIn(profileIds...), subscriptioncoveredprofile.StatusIn(liveCoverageStatuses...)).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range orphaned {
		live, err := client.Subscription.Query().Where(subscription.ID(mustParseUuid(row.SubscriptionID)), subscription.StatusIn(liveStatuses()...)).Exist(ctx)
		if err != nil {
			return err
		}
		if !live {
			stale = append(stale, row.SubscriptionID)
		}
	}
	if len(stale) == 0 {
		return nil
	}
	return client.SubscriptionCoveredProfile.Update().Where(subscriptioncoveredprofile.SubscriptionIDIn(stale...), subscriptioncoveredprofile.StatusIn(liveCoverageStatuses...)).
		SetStatus(subscriptioncoveredprofile.StatusReleased).SetEndedAt(billing.Container.Now().UTC()).Exec(ctx)
}

func (billing Billing) StartCombinedGoldCheckout(ctx context.Context, combined CombinedGoldCheckoutRequest) (CheckoutView, error) {
	request := combined.Checkout
	request.PlanCode = constants.PlanGoldCombined
	if request.ClientPlatform == "ios" || request.ClientPlatform == "android" {
		return CheckoutView{}, paymentservices.ErrWebBillingOnly
	}
	personal, found, err := billing.personalProfileOf(ctx, request.UserId)
	if err != nil || !found {
		return CheckoutView{}, firstError(err, ErrProfileNotFound)
	}
	request.ViewerCountry = firstNonEmpty(personal.CountryCode, request.ViewerCountry)
	client := billing.Container.Client(billing.Container.Resources.Database)
	pricing, err := billing.quoteCombinedGoldForCheckout(ctx, client, request, combined.ProfileIds)
	if err != nil {
		return CheckoutView{}, err
	}
	if combined.ExpectedTotalMinor != nil && *combined.ExpectedTotalMinor != pricing.Price.AmountMinor {
		return CheckoutView{}, ErrCombinedGoldPriceChanged
	}
	if pricing.Regional.NotChargeableOnWeb {
		return CheckoutView{}, ErrWebCurrencyDisabled
	}
	for _, profile := range pricing.Profiles {
		if err := billing.RequireCheckmarkPurchaseAllowed(ctx, constants.PlanGoldOnly, profile.ProfileId); err != nil {
			return CheckoutView{}, err
		}
	}
	profileIds := profileIdsOf(pricing.Profiles)
	currency := pricing.Regional.Currency
	firstCharge := models.CombinedGoldCharge(pricing.Quote, pricing.Price, 0)
	subscriptionId, periodId := uuid.Must(uuid.NewV7()), uuid.Must(uuid.NewV7())
	now := billing.Container.Now().UTC()
	var intentId uuid.UUID
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		tx := billing.Container.Client(transaction)
		if err := lockGoldProfilesInTransaction(ctx, transaction, profileIds); err != nil {
			return err
		}
		if err := billing.releaseAbandonedCombinedCheckoutsInTransaction(ctx, tx, request.UserId, profileIds); err != nil {
			return err
		}
		if err := billing.refuseProfilesWithOwnGoldInTransaction(ctx, tx, profileIds); err != nil {
			return err
		}
		if err := billing.bindOfferClaimToCheckoutInTransaction(ctx, transaction, pricing.Offer, subscriptionId, personal.ProfileId); err != nil {
			return err
		}
		create := tx.Subscription.Create().SetID(subscriptionId).SetProfileID(personal.ProfileId).SetProfileType(constants.ProfilePersonal).SetOwnerUserID(request.UserId).
			SetPlanCode(constants.PlanGoldCombined).SetInterval(subscription.Interval(request.Interval)).SetChannel(subscription.ChannelWebCheckout).
			SetListAmountMinor(pricing.Price.ListAmountMinor).SetAmountMinor(pricing.Price.AmountMinor).SetCurrency(currency).SetDiscountKind(subscription.DiscountKind(pricing.Price.DiscountKind)).
			SetDiscountBps(pricing.Price.DiscountBps).SetPeriodPriceMinor(pricing.Price.AmountMinor).SetCreatedAt(now)
		applyOfferToNewSubscription(create, pricing.Offer)
		if err := create.Exec(ctx); err != nil {
			if ent.IsConstraintError(err) {
				return ErrAlreadySubscribed
			}
			return err
		}
		for _, profileId := range profileIds {
			if err := tx.SubscriptionCoveredProfile.Create().SetSubscriptionID(subscriptionId.String()).SetOwnerUserID(request.UserId).SetProfileID(profileId).
				SetActivatesWithPeriodID(periodId.String()).SetCreatedAt(now).Exec(ctx); err != nil {
				if ent.IsConstraintError(err) {
					return ErrProfileCoveredByCombinedGold
				}
				return err
			}
		}
		var err error
		intentId, err = billing.createFirstPeriodInTransaction(ctx, transaction, firstPeriodRequest{
			SubscriptionId: subscriptionId, PeriodId: periodId, OwnerUserId: request.UserId, PlanCode: constants.PlanGoldCombined, Interval: request.Interval,
			Currency: currency, Charge: firstCharge, StartsAt: now, ReturnTo: request.ReturnTo, ProfileId: personal.ProfileId, PeriodPrice: pricing.Price.ListAmountMinor,
		})
		if err != nil || firstCharge.AmountDueMinor > 0 {
			return err
		}
		return billing.settleFreeFirstPeriodInTransaction(ctx, transaction, subscriptionId, periodId)
	})
	if err != nil {
		return CheckoutView{}, err
	}
	view := CheckoutView{SubscriptionId: subscriptionId.String(), Provider: "flutterwave", Price: money(pricing.Price.AmountMinor, currency), Discount: pricing.Price,
		BillingNote: webBillingNote(pricing.Regional), Offer: checkoutOfferSummaryOf(pricing.Offer, pricing.Price, currency), LineItems: firstCharge.LineItems}
	if intentId == uuid.Nil {
		view.Activated = true
		return view, nil
	}
	opened, err := billing.Container.Payments.OpenProviderCheckoutForIntent(ctx, intentId)
	if err != nil {
		return CheckoutView{}, billing.failStartedSubscription(ctx, subscriptionId, err)
	}
	if opened.CheckoutUrl != nil {
		view.AuthorizationUrl = *opened.CheckoutUrl
	}
	view.Reference = opened.Reference
	return view, nil
}

func (billing Billing) personalProfileOf(ctx context.Context, ownerUserId string) (repositories.BillingProfile, bool, error) {
	if lister, supported := billing.Container.Identity.(repositories.PersonalProfileFinder); supported {
		return lister.FindPersonalProfile(ctx, ownerUserId)
	}
	return repositories.BillingProfile{}, false, nil
}

func profileIdsOf(profiles []repositories.BillingProfile) []string {
	identifiers := make([]string, 0, len(profiles))
	for _, profile := range profiles {
		identifiers = append(identifiers, profile.ProfileId)
	}
	return identifiers
}

func sortedCopy(values []string) []string {
	copied := slices.Clone(values)
	slices.Sort(copied)
	return copied
}
