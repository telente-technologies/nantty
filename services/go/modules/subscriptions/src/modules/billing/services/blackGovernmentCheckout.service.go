package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/models"
	"nantty/platform/regionpricing"
)

func (billing Billing) StartGovernmentBlackCheckout(ctx context.Context, userId string, request BlackCheckoutRequest) (CheckoutView, error) {
	if request.ClientPlatform == "ios" || request.ClientPlatform == "android" {
		return CheckoutView{}, errors.New("Black Government checkout is web-only")
	}
	if request.Interval != "" && request.Interval != "month" {
		return CheckoutView{}, ErrBlackAnnualDisabled
	}
	if request.OfferClaimId != "" {
		return CheckoutView{}, ErrBlackDiscountsDisabled
	}
	if !request.TermsAccepted || !request.RecurringConsent {
		return CheckoutView{}, ErrBlackTermsRequired
	}
	profile, err := billing.resolveGovernmentProfile(ctx, userId, request.ProfileId)
	if err != nil {
		return CheckoutView{}, err
	}
	app, found, err := billing.findBlackEligibility(ctx, profile.ProfileId)
	if err != nil {
		return CheckoutView{}, err
	}
	if !found || app.Status != "approved" || !app.InstitutionalEmailVerified {
		return CheckoutView{}, ErrBlackVerificationRequired
	}
	now := billing.Container.Now().UTC()
	if !app.PrivateCheckoutEnabled || app.PrivateCheckoutRevokedAt != nil {
		return CheckoutView{}, ErrBlackCheckoutNotAuthorized
	}
	if app.PrivateCheckoutExpiresAt != nil && !app.PrivateCheckoutExpiresAt.After(now) {
		return CheckoutView{}, ErrBlackCheckoutExpired
	}
	price, err := billing.resolveAuthoritativeBlackPrice(ctx, app.JurisdictionCountryCode)
	if err != nil {
		return CheckoutView{}, err
	}
	if billing.Container.Payments != nil && !billing.Container.Payments.SupportsRecurringCardCurrency(regionpricing.BlackCurrencyCode) {
		return CheckoutView{}, ErrUsdRecurringUnsupported
	}
	existing, err := billing.latestBlackSubscription(ctx, profile.ProfileId)
	if err != nil {
		return CheckoutView{}, err
	}
	if existing != nil && (existing.Status == subscription.StatusActive || existing.Status == subscription.StatusPastDue || existing.Status == subscription.StatusGrace || existing.Status == subscription.StatusPaused) {
		return CheckoutView{}, ErrAlreadySubscribed
	}
	subscriptionId, periodId := uuid.Must(uuid.NewV7()), uuid.Must(uuid.NewV7())
	charge := models.PeriodCharge{
		LineItems: []models.LineItem{{Kind: models.LineItemPlanBase, Label: "Black Government (Monthly)", AmountMinor: price.WebMonthlyMinor}},
		SubtotalMinor: price.WebMonthlyMinor, AmountDueMinor: price.WebMonthlyMinor, CheckmarkIncluded: true,
	}
	var intentId uuid.UUID
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := billing.Container.Client(transaction)
		if existing != nil && (existing.Status == subscription.StatusPending || existing.Status == subscription.StatusAwaitingCard) {
			if err := client.Subscription.UpdateOneID(existing.ID).SetStatus(subscription.StatusCanceled).SetEndedReason("superseded_checkout").Exec(ctx); err != nil {
				return err
			}
		}
		if _, err := client.Subscription.Create().SetID(subscriptionId).SetProfileID(profile.ProfileId).SetProfileType(profile.ProfileType).
			SetOwnerUserID(userId).SetPlanCode(constants.PlanBlack).SetInterval(subscription.IntervalMonth).SetChannel(subscription.ChannelWebCheckout).
			SetStatus(subscription.StatusPending).SetListAmountMinor(price.WebMonthlyMinor).SetAmountMinor(price.WebMonthlyMinor).
			SetPeriodPriceMinor(price.WebMonthlyMinor).SetCurrency(regionpricing.BlackCurrencyCode).SetDiscountKind(subscription.DiscountKindNone).
			SetDiscountBps(0).SetCheckmarkIncluded(true).SetCreatedAt(now).Save(ctx); err != nil {
			return err
		}
		if _, err := transaction.ExecContext(ctx, `
			UPDATE subscriptions
			SET black_application_id = $2, verified_jurisdiction_country = $3, terms_accepted_at = $4, recurring_consent_at = $4
			WHERE id = $1`, subscriptionId, app.ApplicationId, strings.ToUpper(app.JurisdictionCountryCode), now); err != nil {
			return err
		}
		intentId, err = billing.createFirstPeriodInTransaction(ctx, transaction, firstPeriodRequest{
			SubscriptionId: subscriptionId, PeriodId: periodId, OwnerUserId: userId, ProfileId: profile.ProfileId,
			PlanCode: constants.PlanBlack, Interval: "month", Currency: regionpricing.BlackCurrencyCode,
			Charge: charge, StartsAt: now, ReturnTo: request.ReturnTo, PeriodPrice: price.WebMonthlyMinor,
		})
		if err != nil {
			return err
		}
		billing.recordBlackBillingEvent(ctx, transaction, BlackBillingEventView{
			SubscriptionId: subscriptionId.String(), ApplicationId: app.ApplicationId, ProfileId: profile.ProfileId, OwnerUserId: userId,
			EventKind: "checkout_started", ActorKind: "user", ActorId: userId,
			Summary: "Initiated private Black Government USD monthly checkout",
			Metadata: map[string]any{"amountMinor": price.WebMonthlyMinor, "currency": "USD", "jurisdiction": app.JurisdictionCountryCode},
		})
		return nil
	})
	if err != nil {
		return CheckoutView{}, err
	}
	opened, err := billing.Container.Payments.OpenProviderCheckoutForIntent(ctx, intentId)
	if err != nil {
		return CheckoutView{}, err
	}
	view := CheckoutView{
		SubscriptionId: subscriptionId.String(), Provider: "flutterwave", Price: money(price.WebMonthlyMinor, regionpricing.BlackCurrencyCode),
		Discount: models.PriceQuote{ListAmountMinor: price.WebMonthlyMinor, AmountMinor: price.WebMonthlyMinor, DiscountKind: "none"},
		LineItems: charge.LineItems, Reference: opened.Reference,
	}
	if opened.CheckoutUrl != nil {
		view.AuthorizationUrl = *opened.CheckoutUrl
	}
	return view, nil
}
