package services

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionofferclaim"
	"nantty/modules/subscriptions/src/models"
	"nantty/platform/httpserver"
)

var (
	ErrOfferReservationInvalid = httpserver.NewApiError(http.StatusConflict, "OFFER_RESERVATION_INVALID", "This offer reservation has ended. Open the offer link again to claim it.")
	ErrOfferNotForPlan         = httpserver.NewApiError(http.StatusUnprocessableEntity, "OFFER_NOT_FOR_PLAN", "This offer doesn't apply to this plan.")
	ErrOfferNotWithTrial       = httpserver.NewApiError(http.StatusUnprocessableEntity, "OFFER_NOT_WITH_TRIAL", "This offer can't be combined with a free trial.")
)

type checkoutOffer struct {
	ClaimId        uuid.UUID
	Terms          models.OfferTerms
	DurationCycles int
	Applied        bool
}

type CheckoutOfferSummary struct {
	ClaimId       string         `json:"claimId"`
	Applied       bool           `json:"applied"`
	DiscountTotal map[string]any `json:"discount"`
}

func (billing Billing) quoteWithOfferClaim(ctx context.Context, client *ent.Client, request CheckoutRequest, quote models.PriceQuote, currency string) (models.PriceQuote, *checkoutOffer, error) {
	if request.OfferClaimId == "" {
		return quote, nil, nil
	}
	if request.WithTrial {
		return quote, nil, ErrOfferNotWithTrial
	}
	claimId, err := uuid.Parse(request.OfferClaimId)
	if err != nil {
		return quote, nil, ErrOfferReservationInvalid
	}
	claim, err := client.SubscriptionOfferClaim.Get(ctx, claimId)
	if ent.IsNotFound(err) {
		return quote, nil, ErrOfferReservationInvalid
	}
	if err != nil {
		return quote, nil, err
	}
	if claim.OwnerUserID != request.UserId || claim.Status != subscriptionofferclaim.StatusReserved || !billing.Container.Now().UTC().Before(claim.ReservedUntil) {
		return quote, nil, ErrOfferReservationInvalid
	}
	link, err := client.SubscriptionOfferLink.Get(ctx, mustParseUuid(claim.LinkID))
	if err != nil {
		return quote, nil, err
	}
	if link.RevokedAt != nil {
		return quote, nil, ErrOfferRevoked
	}
	if !offerPlanAllowed(link, request.PlanCode) {
		return quote, nil, ErrOfferNotForPlan
	}
	terms := offerTermsOf(link)
	terms.PlanCode = request.PlanCode
	if !terms.AppliesToCurrency(currency) {
		return quote, nil, ErrOfferCurrencyMismatch
	}
	offered, applied := models.ApplyOfferWhenItBeatsTheQuote(quote, terms, currency)
	return offered, &checkoutOffer{ClaimId: claim.ID, Terms: terms, DurationCycles: link.DurationCycles, Applied: applied}, nil
}

func (billing Billing) bindOfferClaimToCheckoutInTransaction(ctx context.Context, transaction *sql.Tx, offer *checkoutOffer, subscriptionId uuid.UUID, profileId string) error {
	if offer == nil {
		return nil
	}
	client := billing.Container.Client(transaction)
	claim, err := client.SubscriptionOfferClaim.Query().Where(subscriptionofferclaim.ID(offer.ClaimId)).ForUpdate().Only(ctx)
	if err != nil {
		return err
	}
	if claim.Status != subscriptionofferclaim.StatusReserved {
		return ErrOfferReservationInvalid
	}
	if claim.SubscriptionID != "" {
		if err := client.Subscription.Update().Where(subscription.ID(mustParseUuid(claim.SubscriptionID)), subscription.StatusEQ(subscription.StatusPending)).
			SetStatus(subscription.StatusCanceled).SetLastError("Replaced by a newer offer checkout.").Exec(ctx); err != nil {
			return err
		}
	}
	if !offer.Applied {
		return billing.releaseOfferClaimInTransaction(ctx, client, claim)
	}
	return claim.Update().SetSubscriptionID(subscriptionId.String()).SetProfileID(profileId).SetReservedUntil(billing.Container.Now().UTC().Add(OfferReservationWindow)).Exec(ctx)
}

func applyOfferToNewSubscription(create *ent.SubscriptionCreate, offer *checkoutOffer) {
	if offer != nil && offer.Applied {
		create.SetOfferClaimID(offer.ClaimId.String()).SetOfferTerms(offer.Terms).SetOfferCyclesRemaining(offer.DurationCycles)
	}
}

func checkoutOfferSummaryOf(offer *checkoutOffer, quote models.PriceQuote, currency string) *CheckoutOfferSummary {
	if offer == nil {
		return nil
	}
	return &CheckoutOfferSummary{ClaimId: offer.ClaimId.String(), Applied: offer.Applied, DiscountTotal: money(quote.OfferDiscountMinor, currency)}
}

func (billing Billing) applyRemainingOfferCycle(row *ent.Subscription, plan NextPeriodPlan, input models.PeriodChargeInput, monthlyMinor int64) NextPeriodPlan {
	terms := row.OfferTerms
	if row.OfferCyclesRemaining <= 0 || terms.PlanCode != plan.PlanCode || !terms.AppliesToCurrency(plan.Currency) {
		return plan
	}
	list := plan.PeriodPriceMinor
	if plan.Interval == "year" {
		list = max(list, monthlyMinor*12)
	}
	discount := terms.DiscountMinorOn(list, plan.Currency)
	if discount <= 0 || list-discount >= plan.Charge.SubtotalMinor {
		return plan
	}
	input.PeriodPriceMinor, input.BundleDiscountBps, input.OfferDiscountMinor = list, 0, discount
	plan.PeriodPriceMinor, plan.Charge = list, models.ComputePeriodCharge(input)
	return plan
}
