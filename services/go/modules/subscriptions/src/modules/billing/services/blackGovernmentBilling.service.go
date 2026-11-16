package services

import (
	"context"
	"database/sql"
	"net/http"
	"regexp"
	"strings"
	"time"

	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"nantty/modules/subscriptions/src/repositories"
	"nantty/platform/httpserver"
	"nantty/platform/regionpricing"
)

var (
	ErrBlackVerificationRequired  = httpserver.NewApiError(http.StatusForbidden, "BLACK_VERIFICATION_REQUIRED", "An approved government Black verification is required.")
	ErrBlackCheckoutNotAuthorized = httpserver.NewApiError(http.StatusForbidden, "BLACK_CHECKOUT_NOT_AUTHORIZED", "Private Black checkout is not currently authorized for this organization.")
	ErrBlackCheckoutExpired       = httpserver.NewApiError(http.StatusForbidden, "BLACK_CHECKOUT_EXPIRED", "This private checkout authorization has expired. Request a new authorization from verification support.")
	ErrBlackJurisdictionMissing   = httpserver.NewApiError(http.StatusUnprocessableEntity, "BLACK_JURISDICTION_REQUIRED", "Verified legal jurisdiction is required before private Black pricing can be determined.")
	ErrBlackPriceUnavailable      = httpserver.NewApiError(http.StatusServiceUnavailable, "BLACK_PRICE_UNAVAILABLE", "Government subscription pricing is temporarily unavailable. Please try again later.")
	ErrBlackDiscountsDisabled     = httpserver.NewApiError(http.StatusUnprocessableEntity, "BLACK_DISCOUNTS_DISABLED", "Discounts are disabled for Black Government subscriptions.")
	ErrUsdRecurringUnsupported    = httpserver.NewApiError(http.StatusUnprocessableEntity, "USD_RECURRING_UNSUPPORTED", "Recurring USD card billing is not enabled on the payment provider.")
	ErrBlackTermsRequired         = httpserver.NewApiError(http.StatusUnprocessableEntity, "BLACK_TERMS_REQUIRED", "You must review and accept the recurring USD billing terms before checkout.")
	ErrBlackCardRequired          = httpserver.NewApiError(http.StatusConflict, "BILLING_CARD_MISSING", "Add an eligible recurring USD payment card before reactivating.")
)

var isoCountryRegex = regexp.MustCompile(`^[A-Z]{2}$`)

type BlackCheckoutRequest struct {
	ProfileId        string
	Interval         string
	OfferClaimId     string
	TermsAccepted    bool
	RecurringConsent bool
	ReturnTo         string
	ClientPlatform   string
}

type GovernmentBlackDashboardView struct {
	Verification GovernmentVerificationSummary `json:"verification"`
	Pricing      *GovernmentBlackPricingView   `json:"pricing"`
	Disclosures  *GovernmentBlackDisclosures   `json:"disclosures"`
	Subscription *GovernmentSubscriptionView   `json:"subscription"`
	Invoices     []BillingPeriodView           `json:"invoices"`
	Events       []BlackBillingEventView       `json:"events"`
}

type GovernmentVerificationSummary struct {
	ApplicationId              string     `json:"applicationId"`
	ProfileId                  string     `json:"profileId"`
	AgencyName                 string     `json:"agencyName"`
	Handle                     string     `json:"handle"`
	Status                     string     `json:"status"`
	JurisdictionCountryCode    string     `json:"jurisdictionCountryCode"`
	InstitutionalEmail         string     `json:"institutionalEmail"`
	InstitutionalEmailVerified bool       `json:"institutionalEmailVerified"`
	PrivateCheckoutEnabled     bool       `json:"privateCheckoutEnabled"`
	PrivateCheckoutExpiresAt   *time.Time `json:"privateCheckoutExpiresAt,omitempty"`
	ReverificationDueAt        *time.Time `json:"reverificationDueAt,omitempty"`
}

type GovernmentBlackPricingView struct {
	PlanCode              string         `json:"planCode"`
	Interval              string         `json:"interval"`
	Currency              string         `json:"currency"`
	Price                 map[string]any `json:"price"`
	AnnualBillingDisabled bool           `json:"annualBillingDisabled"`
	DiscountsDisabled     bool           `json:"discountsDisabled"`
	RecurringCardRequired bool           `json:"recurringCardRequired"`
	RecurringCardEnabled  bool           `json:"recurringCardEnabled"`
	RegionBasis           string         `json:"regionBasis"`
}

type GovernmentBlackDisclosures struct {
	MonthlyAmountFormatted  string `json:"monthlyAmountFormatted"`
	Currency                string `json:"currency"`
	BillingCadence          string `json:"billingCadence"`
	AutoRenewalTerms        string `json:"autoRenewalTerms"`
	NextBillingNotice       string `json:"nextBillingNotice"`
	CancellationTerms       string `json:"cancellationTerms"`
	FailureConsequences     string `json:"failureConsequences"`
	CardRemovalConsequences string `json:"cardRemovalConsequences"`
}

type GovernmentSubscriptionView struct {
	SubscriptionView
	PausedReason           string     `json:"pausedReason,omitempty"`
	BillingAuthorizationId string     `json:"billingAuthorizationId,omitempty"`
	CardUsable             bool       `json:"cardUsable"`
	NextChargeAt           *time.Time `json:"nextChargeAt,omitempty"`
	TermsAcceptedAt        *time.Time `json:"termsAcceptedAt,omitempty"`
	RecurringConsentAt     *time.Time `json:"recurringConsentAt,omitempty"`
}

type BillingPeriodView struct {
	Id               string         `json:"id"`
	Kind             string         `json:"kind"`
	Status           string         `json:"status"`
	Amount           map[string]any `json:"amount"`
	PeriodStartsAt   time.Time      `json:"periodStartsAt"`
	PeriodEndsAt     time.Time      `json:"periodEndsAt"`
	PaidAt           *time.Time     `json:"paidAt,omitempty"`
	PaymentReference string         `json:"paymentReference,omitempty"`
	FailureReason    string         `json:"failureReason,omitempty"`
	InvoiceNumber    string         `json:"invoiceNumber"`
}

func (billing Billing) findBlackEligibility(ctx context.Context, profileId string) (repositories.BlackApplicationEligibility, bool, error) {
	reader, ok := billing.Container.Identity.(repositories.BlackVerificationReader)
	if !ok {
		return repositories.BlackApplicationEligibility{}, false, nil
	}
	return reader.FindBlackApplicationForProfile(ctx, profileId)
}

func (billing Billing) resolveGovernmentProfile(ctx context.Context, userId, profileId string) (repositories.BillingProfile, error) {
	var profile repositories.BillingProfile
	var found bool
	var err error
	if profileId != "" {
		profile, found, err = billing.Container.Identity.FindProfile(ctx, profileId)
	} else {
		profile, found, err = billing.Container.Identity.FindActingProfile(ctx, userId)
	}
	if err != nil {
		return repositories.BillingProfile{}, err
	}
	if !found || profile.OwnerUserId != userId {
		return repositories.BillingProfile{}, ErrProfileNotFound
	}
	if profile.ProfileType != constants.ProfileGovernment {
		return repositories.BillingProfile{}, ErrProfileNotEligible
	}
	return profile, nil
}

func (billing Billing) resolveAuthoritativeBlackPrice(ctx context.Context, jurisdictionCountry string) (regionpricing.PlanRegionalPrice, error) {
	code := strings.ToUpper(strings.TrimSpace(jurisdictionCountry))
	if !isoCountryRegex.MatchString(code) {
		return regionpricing.PlanRegionalPrice{}, ErrBlackJurisdictionMissing
	}
	target, supported := regionpricing.RegionForCountry(code)
	if !supported {
		target = regionpricing.FallbackRegion
	}
	client := billing.Container.Client(billing.Container.Resources.Database)
	row, err := billing.effectivePrice(ctx, client, constants.PlanBlack, target.Code)
	if err != nil {
		return regionpricing.PlanRegionalPrice{}, ErrBlackPriceUnavailable
	}
	price := row.regional()
	if price.Currency != regionpricing.BlackCurrencyCode || price.WebMonthlyMinor <= 0 {
		return regionpricing.PlanRegionalPrice{}, ErrBlackPriceUnavailable
	}
	price.WebYearlyMinor = 0
	price.IosMonthlyMinor, price.IosYearlyMinor = 0, 0
	price.AndroidMonthlyMinor, price.AndroidYearlyMinor = 0, 0
	return price, nil
}

func (billing Billing) GetGovernmentBlackBilling(ctx context.Context, userId, profileId string) (GovernmentBlackDashboardView, error) {
	profile, err := billing.resolveGovernmentProfile(ctx, userId, profileId)
	if err != nil {
		return GovernmentBlackDashboardView{}, err
	}
	app, found, err := billing.findBlackEligibility(ctx, profile.ProfileId)
	if err != nil {
		return GovernmentBlackDashboardView{}, err
	}
	if !found {
		return GovernmentBlackDashboardView{}, ErrBlackVerificationRequired
	}
	view := GovernmentBlackDashboardView{
		Verification: GovernmentVerificationSummary{
			ApplicationId: app.ApplicationId, ProfileId: profile.ProfileId, AgencyName: app.AgencyName, Handle: app.Handle,
			Status: app.Status, JurisdictionCountryCode: app.JurisdictionCountryCode, InstitutionalEmail: app.InstitutionalEmail,
			InstitutionalEmailVerified: app.InstitutionalEmailVerified, PrivateCheckoutEnabled: app.PrivateCheckoutEnabled,
			PrivateCheckoutExpiresAt: app.PrivateCheckoutExpiresAt, ReverificationDueAt: app.ReverificationDueAt,
		},
		Invoices: []BillingPeriodView{}, Events: []BlackBillingEventView{},
	}
	if app.Status == "approved" && app.InstitutionalEmailVerified && isoCountryRegex.MatchString(strings.ToUpper(app.JurisdictionCountryCode)) {
		price, err := billing.resolveAuthoritativeBlackPrice(ctx, app.JurisdictionCountryCode)
		if err != nil {
			return GovernmentBlackDashboardView{}, err
		}
		recurringSupported := billing.Container.Payments == nil || billing.Container.Payments.SupportsRecurringCardCurrency(regionpricing.BlackCurrencyCode)
		view.Pricing = &GovernmentBlackPricingView{
			PlanCode: constants.PlanBlack, Interval: "month", Currency: regionpricing.BlackCurrencyCode,
			Price: money(price.WebMonthlyMinor, regionpricing.BlackCurrencyCode), AnnualBillingDisabled: true,
			DiscountsDisabled: true, RecurringCardRequired: true, RecurringCardEnabled: recurringSupported,
			RegionBasis: "verified_legal_jurisdiction",
		}
		usdMajor := price.WebMonthlyMinor / 100
		view.Disclosures = &GovernmentBlackDisclosures{
			MonthlyAmountFormatted:  "USD " + formatInt64(usdMajor) + "/month",
			Currency:                regionpricing.BlackCurrencyCode,
			BillingCadence:          "Monthly recurring charge billed automatically every month.",
			AutoRenewalTerms:        "Your authorized USD payment card will be charged automatically each month until cancelled or paused.",
			NextBillingNotice:       "Your first billing period starts upon verified server-side payment and renews monthly on the same billing anchor day.",
			CancellationTerms:       "You may cancel at any time; cancellation stops future renewals at the end of your current paid period.",
			FailureConsequences:     "Failed renewal charges trigger automatic retry notices and suspend the Black checkmark once paid coverage ends.",
			CardRemovalConsequences: "Removing or disconnecting your recurring card immediately pauses your Black entitlement until a valid card is added.",
		}
	}
	row, err := billing.latestBlackSubscription(ctx, profile.ProfileId)
	if err != nil {
		return GovernmentBlackDashboardView{}, err
	}
	if row != nil {
		subView := billing.convertGovernmentSubscription(ctx, row)
		view.Subscription = &subView
		periods, err := billing.Container.Client(billing.Container.Resources.Database).SubscriptionPeriod.Query().
			Where(subscriptionperiod.SubscriptionID(row.ID.String())).Order(ent.Desc(subscriptionperiod.FieldPeriodStartsAt)).Limit(50).All(ctx)
		if err != nil {
			return GovernmentBlackDashboardView{}, err
		}
		for _, p := range periods {
			view.Invoices = append(view.Invoices, BillingPeriodView{
				Id: p.ID.String(), Kind: string(p.Kind), Status: string(p.Status), Amount: money(p.AmountDueMinor, p.Currency),
				PeriodStartsAt: p.PeriodStartsAt, PeriodEndsAt: p.PeriodEndsAt, PaidAt: p.PaidAt,
				PaymentReference: p.PaymentReference, FailureReason: p.FailureReason,
				InvoiceNumber: "INV-" + row.ID.String()[:8] + "-" + p.PeriodStartsAt.UTC().Format("20060102"),
			})
		}
	}
	if events, err := billing.listBlackBillingEvents(ctx, profile.ProfileId, 30); err == nil {
		view.Events = events
	}
	return view, nil
}

func (billing Billing) latestBlackSubscription(ctx context.Context, profileId string) (*ent.Subscription, error) {
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.ProfileID(profileId), subscription.PlanCodeEQ(constants.PlanBlack)).
		Order(ent.Desc(subscription.FieldCreatedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func (billing Billing) convertGovernmentSubscription(ctx context.Context, row *ent.Subscription) GovernmentSubscriptionView {
	out := GovernmentSubscriptionView{
		SubscriptionView: ConvertSubscription(row), BillingAuthorizationId: row.BillingAuthorizationID, NextChargeAt: row.NextChargeAt,
	}
	if row.BillingAuthorizationID != "" && billing.Container.Payments != nil {
		if summary, err := billing.Container.Payments.DescribeBillingAuthorization(ctx, row.BillingAuthorizationID); err == nil {
			out.CardUsable = summary.Usable
		}
	}
	_ = billing.Container.Resources.Database.QueryRowContext(ctx,
		`SELECT paused_reason, terms_accepted_at, recurring_consent_at FROM subscriptions WHERE id = $1`, row.ID).
		Scan(&out.PausedReason, &out.TermsAcceptedAt, &out.RecurringConsentAt)
	return out
}

func formatInt64(v int64) string {
	if v == 0 {
		return "0"
	}
	buf := [20]byte{}
	i := len(buf)
	for v > 0 {
		i--
		buf[i] = byte('0' + v%10)
		v /= 10
	}
	return string(buf[i:])
}

var _ paymentmodels.BillingAuthorizationRevokedObserver = Billing{}
var _ interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
} = (*sql.Tx)(nil)
