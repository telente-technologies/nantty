package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	paymentinterfaces "zudomart/modules/payments/src/interfaces"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/providerplan"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/trialclaim"
	"zudomart/modules/subscriptions/src/loaders"
	"zudomart/modules/subscriptions/src/models"
	"zudomart/platform/httpserver"
	"zudomart/platform/regionpricing"
)

type CheckoutRequest struct {
	UserId         string
	ProfileId      string
	PlanCode       string
	Interval       string
	WithTrial      bool
	ReturnTo       string
	ClientPlatform string
	DeviceId       string
	ViewerCountry  string
	OfferClaimId   string
}

type CheckoutView struct {
	SubscriptionId   string                `json:"subscriptionId"`
	AuthorizationUrl string                `json:"authorizationUrl"`
	Reference        string                `json:"reference"`
	Provider         string                `json:"provider"`
	Price            map[string]any        `json:"price"`
	Discount         models.PriceQuote     `json:"discount"`
	Trial            bool                  `json:"trial"`
	BillingNote      string                `json:"billingNote,omitempty"`
	LineItems        []models.LineItem     `json:"lineItems,omitempty"`
	Offer            *CheckoutOfferSummary `json:"offer,omitempty"`
	Activated        bool                  `json:"activated,omitempty"`
}

type TrialNotAvailableError struct {
	Reasons []models.IneligibleReason
}

func (failure TrialNotAvailableError) Error() string { return "trial not available" }

func (billing Billing) StartCheckout(ctx context.Context, request CheckoutRequest) (CheckoutView, error) {
	if request.ClientPlatform == "ios" || request.ClientPlatform == "android" {
		return CheckoutView{}, paymentservices.ErrWebBillingOnly
	}
	definition, known := constants.Plans[request.PlanCode]
	if !known {
		return CheckoutView{}, ErrPlanNotFound
	}
	if !definition.SelfServe || !loaders.ReadPlanCatalogue(ctx, billing.Container.Resources.Platform)[request.PlanCode].IsPurchasable {
		return CheckoutView{}, ErrPlanNotSelfServe
	}
	profile, found, err := billing.Container.Identity.FindProfile(ctx, request.ProfileId)
	if err != nil {
		return CheckoutView{}, err
	}
	if !found || profile.OwnerUserId != request.UserId {
		return CheckoutView{}, ErrProfileNotFound
	}
	if !PlanAllowedForProfile(request.PlanCode, profile.ProfileType) {
		return CheckoutView{}, ErrProfileNotEligible
	}
	if err := billing.RequireCheckmarkPurchaseAllowed(ctx, request.PlanCode, profile.ProfileId); err != nil {
		return CheckoutView{}, err
	}
	chargingCountry := firstNonEmpty(profile.CountryCode, request.ViewerCountry)
	if chargingCountry == "" {
		return CheckoutView{}, regionpricing.ErrCountryRequired
	}
	client := billing.Container.Client(billing.Container.Resources.Database)
	quote, price, err := billing.QuoteForOwnerOnChannel(ctx, client, request.UserId, request.PlanCode, chargingCountry, request.Interval, "web")
	if err != nil {
		return CheckoutView{}, err
	}
	if price.NotChargeableOnWeb {
		return CheckoutView{}, ErrWebCurrencyDisabled
	}
	currency := price.Currency
	quote, offer, err := billing.quoteWithOfferClaim(ctx, client, request, quote, currency)
	if err != nil {
		return CheckoutView{}, err
	}
	trialRules, _ := billing.rules(ctx)
	if request.WithTrial {
		if reasons, err := billing.TrialIneligibility(ctx, client, request, definition.TrialAllowed); err != nil || len(reasons) > 0 {
			return CheckoutView{}, errors.Join(err, trialErrorFor(reasons))
		}
	}
	subscriptionId, periodId := uuid.Must(uuid.NewV7()), uuid.Must(uuid.NewV7())
	now := billing.Container.Now().UTC()
	firstCharge := FirstPeriodCharge(request.PlanCode, quote, billing.standaloneCheckmarkPriceMinor(ctx, definition.Checkmark, currency, "web", request.Interval))
	var intentId uuid.UUID
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if err := billing.bindOfferClaimToCheckoutInTransaction(ctx, transaction, offer, subscriptionId, profile.ProfileId); err != nil {
			return err
		}
		create := billing.Container.Client(transaction).Subscription.Create().SetID(subscriptionId).SetProfileID(profile.ProfileId).SetProfileType(profile.ProfileType).
			SetOwnerUserID(request.UserId).SetPlanCode(request.PlanCode).SetInterval(subscription.Interval(request.Interval)).SetChannel(subscription.ChannelWebCheckout).
			SetListAmountMinor(quote.ListAmountMinor).SetAmountMinor(quote.AmountMinor).SetCurrency(currency).SetDiscountKind(subscription.DiscountKind(quote.DiscountKind)).
			SetDiscountBps(quote.DiscountBps).SetWithTrial(request.WithTrial).SetPeriodPriceMinor(firstCharge.SubtotalMinor + models.DiscountLinesTotalMinor(firstCharge)).SetCreatedAt(now)
		applyOfferToNewSubscription(create, offer)
		if request.WithTrial {
			create.SetStatus(subscription.StatusAwaitingCard).SetTrialDays(trialRules.TrialDays)
		}
		if err := create.Exec(ctx); err != nil {
			if ent.IsConstraintError(err) {
				return ErrAlreadySubscribed
			}
			return err
		}
		if request.WithTrial {
			return billing.claimTrialFingerprintsInTransaction(ctx, transaction, subscriptionId.String(), request)
		}
		var err error
		intentId, err = billing.createFirstPeriodInTransaction(ctx, transaction, firstPeriodRequest{
			SubscriptionId: subscriptionId, PeriodId: periodId, OwnerUserId: request.UserId, PlanCode: request.PlanCode, Interval: request.Interval,
			Currency: currency, Charge: firstCharge, StartsAt: now, ReturnTo: request.ReturnTo, ProfileId: profile.ProfileId,
		})
		if err != nil || firstCharge.AmountDueMinor > 0 {
			return err
		}
		return billing.settleFreeFirstPeriodInTransaction(ctx, transaction, subscriptionId, periodId)
	})
	if err != nil {
		return CheckoutView{}, err
	}
	view := CheckoutView{SubscriptionId: subscriptionId.String(), Provider: "flutterwave", Price: money(quote.AmountMinor, currency), Discount: quote, Trial: request.WithTrial, BillingNote: webBillingNote(price),
		Offer: checkoutOfferSummaryOf(offer, quote, currency)}
	metadata := map[string]string{"subscriptionId": subscriptionId.String(), "profileId": profile.ProfileId}
	if request.WithTrial {
		verificationAmount, verificationCurrency := regionpricing.CardVerificationCharge(currency)
		started, err := billing.Container.Payments.StartSavedCardSetup(ctx, paymentservices.CardSetupRequest{
			UserId: request.UserId, ReturnTo: request.ReturnTo, Purpose: "trial", SubjectId: subscriptionId.String(), Metadata: metadata, AmountMinor: verificationAmount, Currency: verificationCurrency,
		})
		if err != nil {
			return CheckoutView{}, billing.failStartedSubscription(ctx, subscriptionId, err)
		}
		view.AuthorizationUrl, view.Reference = started.CheckoutUrl, started.Reference
		return view, nil
	}
	if intentId == uuid.Nil {
		view.Activated, view.LineItems = true, firstCharge.LineItems
		return view, nil
	}
	opened, err := billing.Container.Payments.OpenProviderCheckoutForIntent(ctx, intentId)
	if err != nil {
		return CheckoutView{}, billing.failStartedSubscription(ctx, subscriptionId, err)
	}
	if opened.CheckoutUrl != nil {
		view.AuthorizationUrl = *opened.CheckoutUrl
	}
	view.Reference, view.LineItems = opened.Reference, firstCharge.LineItems
	return view, nil
}

func (billing Billing) failStartedSubscription(ctx context.Context, subscriptionId uuid.UUID, cause error) error {
	_ = billing.Container.Client(billing.Container.Resources.Database).Subscription.UpdateOneID(subscriptionId).SetStatus(subscription.StatusCanceled).SetLastError(truncate(cause.Error(), 300)).Exec(ctx)
	return cause
}

func (billing Billing) ensureProviderPlan(ctx context.Context, planCode, interval string, amountMinor int64, currency string) (string, error) {
	client := billing.Container.Client(billing.Container.Resources.Database)
	existing, err := client.ProviderPlan.Query().Where(providerplan.PlanCode(planCode), providerplan.Interval(interval), providerplan.AmountMinor(amountMinor), providerplan.Currency(currency)).Only(ctx)
	if err == nil {
		return existing.ProviderPlanCode, nil
	}
	if !ent.IsNotFound(err) {
		return "", err
	}
	providerInterval := map[string]string{"month": "monthly", "year": "annually"}[interval]
	code, err := billing.Container.Payments.CreateRecurringPlanProduct(ctx, paymentinterfaces.RecurringPlanRequest{
		Name: fmt.Sprintf("Zudomart %s %s %d", planCode, interval, amountMinor), AmountMinor: amountMinor, Currency: currency, Interval: providerInterval,
	})
	if err != nil {
		return "", err
	}
	if err := client.ProviderPlan.Create().SetPlanCode(planCode).SetInterval(interval).SetAmountMinor(amountMinor).SetCurrency(currency).SetProviderPlanCode(code).
		SetCreatedAt(billing.Container.Now()).OnConflictColumns(providerplan.FieldPlanCode, providerplan.FieldInterval, providerplan.FieldAmountMinor, providerplan.FieldCurrency).
		DoNothing().Exec(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	return code, nil
}

func (billing Billing) fingerprint(value string) string {
	mac := hmac.New(sha256.New, []byte(billing.Container.Settings.FingerprintKey))
	mac.Write([]byte(strings.ToLower(strings.TrimSpace(value))))
	return hex.EncodeToString(mac.Sum(nil))
}

func (billing Billing) emailFingerprint(email string) string {
	return billing.fingerprint("email:" + strings.TrimSpace(email))
}

func (billing Billing) claimTrialFingerprintsInTransaction(ctx context.Context, transaction *sql.Tx, subscriptionId string, request CheckoutRequest) error {
	claims := map[trialclaim.Kind]string{trialclaim.KindPerson: billing.fingerprint("person:" + request.UserId)}
	if request.DeviceId != "" {
		claims[trialclaim.KindDevice] = billing.fingerprint("device:" + request.DeviceId)
	}
	if account, found, err := billing.Container.Identity.ReadAccountSignals(ctx, request.UserId); err == nil && found && strings.TrimSpace(account.Email) != "" {
		claims[trialclaim.KindEmail] = billing.emailFingerprint(account.Email)
	}
	for kind, hash := range claims {
		if err := billing.Container.Client(transaction).TrialClaim.Create().SetKind(kind).SetFingerprintHash(hash).SetSubscriptionID(subscriptionId).SetOwnerUserID(request.UserId).
			SetCreatedAt(billing.Container.Now()).Exec(ctx); err != nil {
			if ent.IsConstraintError(err) {
				return trialErrorFor([]models.IneligibleReason{{Code: "TRIAL_ALREADY_USED", Message: "You've already used your free trial."}})
			}
			return err
		}
	}
	return nil
}

func trialErrorFor(reasons []models.IneligibleReason) error {
	if len(reasons) == 0 {
		return nil
	}
	return httpserver.NewApiError(http.StatusConflict, "TRIAL_NOT_AVAILABLE", reasons[0].Message)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func truncate(value string, maximum int) string {
	if len(value) > maximum {
		return value[:maximum]
	}
	return value
}
