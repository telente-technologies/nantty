package services

import (
	"context"
	"database/sql"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionofferclaim"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionofferlink"
	"nantty/modules/subscriptions/src/repositories"
	"nantty/platform/httpserver"
)

const OfferReservationWindow = time.Hour

var (
	ErrOfferNotFound         = httpserver.NewApiError(http.StatusNotFound, "OFFER_NOT_FOUND", "This offer link isn't valid.")
	ErrOfferRevoked          = httpserver.NewApiError(http.StatusGone, "OFFER_REVOKED", "This offer has been withdrawn.")
	ErrOfferExpired          = httpserver.NewApiError(http.StatusGone, "OFFER_EXPIRED", "This offer has expired.")
	ErrOfferFullyClaimed     = httpserver.NewApiError(http.StatusConflict, "OFFER_FULLY_CLAIMED", "This offer has already been claimed.")
	ErrOfferAlreadyClaimed   = httpserver.NewApiError(http.StatusConflict, "OFFER_ALREADY_CLAIMED", "You've already used this offer.")
	ErrOfferNotForProfile    = httpserver.NewApiError(http.StatusUnprocessableEntity, "OFFER_NOT_FOR_PROFILE", "This offer isn't available for this profile type.")
	ErrOfferCurrencyMismatch = httpserver.NewApiError(http.StatusUnprocessableEntity, "OFFER_CURRENCY_MISMATCH", "This offer is in a different currency from the one you'd be charged in, so it can't be used.")
)

type OfferClaimRequest struct {
	Token           string
	UserId          string
	ProfileId       string
	ChargingCountry string
}

func (billing Billing) findOfferLinkByToken(ctx context.Context, client *ent.Client, token string, forUpdate bool) (*ent.SubscriptionOfferLink, error) {
	if !IsWellFormedOfferToken(token) {
		return nil, ErrOfferNotFound
	}
	query := client.SubscriptionOfferLink.Query().Where(subscriptionofferlink.TokenHash(HashOfferLinkToken(token)))
	if forUpdate {
		query.ForUpdate()
	}
	link, err := query.Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrOfferNotFound
	}
	return link, err
}

func offerStatusError(status string) error {
	return map[string]error{OfferStatusRevoked: ErrOfferRevoked, OfferStatusExpired: ErrOfferExpired, OfferStatusFullyClaimed: ErrOfferFullyClaimed}[status]
}

func eligibleOfferPlansFor(link *ent.SubscriptionOfferLink, profileType string) []string {
	plans := []string{}
	for _, code := range link.PlanCodes {
		if def, known := constants.Plans[code]; known && !def.DiscountsDisabled && PlanAllowedForProfile(code, profileType) {
			plans = append(plans, code)
		}
	}
	return plans
}

func (billing Billing) offerCurrencyFitsAnyPlan(ctx context.Context, client *ent.Client, link *ent.SubscriptionOfferLink, plans []string, country string) bool {
	terms := offerTermsOf(link)
	for _, code := range plans {
		if price, err := billing.RegionalPriceFor(ctx, client, PriceBookPlanOf(code), country, "web"); err == nil && terms.AppliesToCurrency(price.Currency) {
			return true
		}
	}
	return false
}

func (billing Billing) resolveOfferProfile(ctx context.Context, userId, profileId string) (repositories.BillingProfile, error) {
	if profileId == "" {
		profile, found, err := billing.Container.Identity.FindActingProfile(ctx, userId)
		if err != nil || !found {
			return repositories.BillingProfile{}, firstError(err, ErrProfileNotFound)
		}
		return profile, nil
	}
	profile, found, err := billing.Container.Identity.FindProfile(ctx, profileId)
	if err != nil || !found || profile.OwnerUserId != userId {
		return repositories.BillingProfile{}, firstError(err, ErrProfileNotFound)
	}
	return profile, nil
}

func (billing Billing) ClaimOffer(ctx context.Context, request OfferClaimRequest) (OfferClaimView, error) {
	profile, err := billing.resolveOfferProfile(ctx, request.UserId, request.ProfileId)
	if err != nil {
		return OfferClaimView{}, err
	}
	readClient := billing.Container.Client(billing.Container.Resources.Database)
	link, err := billing.findOfferLinkByToken(ctx, readClient, request.Token, false)
	if err != nil {
		return OfferClaimView{}, err
	}
	plans := eligibleOfferPlansFor(link, profile.ProfileType)
	if len(plans) == 0 {
		return OfferClaimView{}, ErrOfferNotForProfile
	}
	if !billing.offerCurrencyFitsAnyPlan(ctx, readClient, link, plans, firstNonEmpty(profile.CountryCode, request.ChargingCountry, billing.Container.Settings.DefaultCountry)) {
		return OfferClaimView{}, ErrOfferCurrencyMismatch
	}
	var claim *ent.SubscriptionOfferClaim
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := billing.Container.Client(transaction)
		link, err := billing.findOfferLinkByToken(ctx, client, request.Token, true)
		if err != nil {
			return err
		}
		now := billing.Container.Now().UTC()
		existing, err := client.SubscriptionOfferClaim.Query().Where(subscriptionofferclaim.LinkID(link.ID.String()), subscriptionofferclaim.OwnerUserID(request.UserId),
			subscriptionofferclaim.StatusIn(subscriptionofferclaim.StatusReserved, subscriptionofferclaim.StatusRedeemed)).ForUpdate().Only(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		if existing != nil && existing.Status == subscriptionofferclaim.StatusRedeemed {
			return ErrOfferAlreadyClaimed
		}
		if status := OfferLinkStatus(link, now); status == OfferStatusRevoked || status == OfferStatusExpired {
			return offerStatusError(status)
		}
		if existing != nil {
			claim, err = existing.Update().SetProfileID(profile.ProfileId).SetReservedUntil(now.Add(OfferReservationWindow)).Save(ctx)
			return err
		}
		if link.ClaimedCount >= link.MaxClaims {
			return ErrOfferFullyClaimed
		}
		updated, err := client.SubscriptionOfferLink.Update().Where(subscriptionofferlink.ID(link.ID), subscriptionofferlink.ClaimedCountLT(link.MaxClaims)).AddClaimedCount(1).Save(ctx)
		if err != nil || updated == 0 {
			return firstError(err, ErrOfferFullyClaimed)
		}
		claim, err = client.SubscriptionOfferClaim.Create().SetID(uuid.Must(uuid.NewV7())).SetLinkID(link.ID.String()).SetOwnerUserID(request.UserId).
			SetProfileID(profile.ProfileId).SetReservedUntil(now.Add(OfferReservationWindow)).SetCreatedAt(now).Save(ctx)
		if ent.IsConstraintError(err) {
			return ErrOfferFullyClaimed
		}
		return err
	})
	if err != nil {
		return OfferClaimView{}, err
	}
	return convertOfferClaim(claim), nil
}

func firstError(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}

func offerPlanAllowed(link *ent.SubscriptionOfferLink, planCode string) bool {
	return slices.Contains(link.PlanCodes, planCode)
}
