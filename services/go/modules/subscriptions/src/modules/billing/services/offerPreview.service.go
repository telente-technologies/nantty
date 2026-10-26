package services

import (
	"context"
	"time"

	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionofferclaim"
	"nantty/modules/subscriptions/src/models"
)

const (
	OfferStateAvailable     = "available"
	OfferStateReservedByYou = "reserved_by_you"
	OfferStateClaimedByYou  = "claimed_by_you"
	OfferStateNotForProfile = "not_for_profile"
	OfferStateWrongCurrency = "wrong_currency"
)

type OfferPreviewRequest struct {
	Token           string
	UserId          string
	ProfileId       string
	ChargingCountry string
}

type OfferIntervalPrice struct {
	Interval     string         `json:"interval"`
	ListPrice    map[string]any `json:"listPrice"`
	RegularPrice map[string]any `json:"regularPrice"`
	OfferPrice   map[string]any `json:"offerPrice"`
	OfferApplies bool           `json:"offerApplies"`
}

type OfferPlanPreview struct {
	PlanCode            string               `json:"planCode"`
	PlanLabel           string               `json:"planLabel"`
	AvailableForProfile bool                 `json:"availableForProfile"`
	Prices              []OfferIntervalPrice `json:"prices"`
}

type OfferPreview struct {
	State          string             `json:"state"`
	Discount       OfferDiscountView  `json:"discount"`
	Plans          []OfferPlanPreview `json:"plans"`
	DurationCycles int                `json:"durationCycles"`
	SingleUse      bool               `json:"singleUse"`
	ExpiresAt      *time.Time         `json:"expiresAt"`
	ProfileId      string             `json:"profileId,omitempty"`
	Claim          *OfferClaimView    `json:"claim"`
}

func (billing Billing) PreviewOffer(ctx context.Context, request OfferPreviewRequest) (OfferPreview, error) {
	client := billing.Container.Client(billing.Container.Resources.Database)
	link, err := billing.findOfferLinkByToken(ctx, client, request.Token, false)
	if err != nil {
		return OfferPreview{}, err
	}
	now := billing.Container.Now().UTC()
	preview := OfferPreview{
		State: OfferLinkStatus(link, now), Discount: offerDiscountViewOf(offerTermsOf(link)), Plans: []OfferPlanPreview{}, DurationCycles: link.DurationCycles,
		SingleUse: link.SingleUse, ExpiresAt: link.ExpiresAt,
	}
	if preview.State == OfferStatusRevoked || preview.State == OfferStatusExpired {
		return preview, nil
	}
	country, profileType := firstNonEmpty(request.ChargingCountry, billing.Container.Settings.DefaultCountry), ""
	if request.UserId != "" {
		if profile, err := billing.resolveOfferProfile(ctx, request.UserId, request.ProfileId); err == nil {
			country, profileType, preview.ProfileId = firstNonEmpty(profile.CountryCode, country), profile.ProfileType, profile.ProfileId
		}
		claim, err := client.SubscriptionOfferClaim.Query().Where(subscriptionofferclaim.LinkID(link.ID.String()), subscriptionofferclaim.OwnerUserID(request.UserId),
			subscriptionofferclaim.StatusIn(subscriptionofferclaim.StatusReserved, subscriptionofferclaim.StatusRedeemed)).Only(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return OfferPreview{}, err
		}
		if claim != nil {
			view := convertOfferClaim(claim)
			preview.Claim, preview.State = &view, map[bool]string{true: OfferStateClaimedByYou, false: OfferStateReservedByYou}[claim.Status == subscriptionofferclaim.StatusRedeemed]
		}
	}
	terms, anyFits, anyEligible := offerTermsOf(link), false, false
	for _, code := range link.PlanCodes {
		plan := OfferPlanPreview{PlanCode: code, PlanLabel: PlanLabel(code), AvailableForProfile: profileType == "" || PlanAllowedForProfile(code, profileType), Prices: []OfferIntervalPrice{}}
		anyEligible = anyEligible || plan.AvailableForProfile
		for _, interval := range []string{"month", "year"} {
			quote, price, err := billing.quoteForOfferPreview(ctx, client, request.UserId, code, country, interval)
			if err != nil || price.NotChargeableOnWeb {
				continue
			}
			offered, applies := models.ApplyOfferWhenItBeatsTheQuote(quote, terms, price.Currency)
			anyFits = anyFits || (plan.AvailableForProfile && terms.AppliesToCurrency(price.Currency))
			plan.Prices = append(plan.Prices, OfferIntervalPrice{
				Interval: interval, ListPrice: money(quote.ListAmountMinor, price.Currency), RegularPrice: money(quote.AmountMinor, price.Currency),
				OfferPrice: money(offered.AmountMinor, price.Currency), OfferApplies: applies,
			})
		}
		preview.Plans = append(preview.Plans, plan)
	}
	if preview.State == OfferStatusActive {
		switch {
		case !anyEligible:
			preview.State = OfferStateNotForProfile
		case !anyFits:
			preview.State = OfferStateWrongCurrency
		default:
			preview.State = OfferStateAvailable
		}
	}
	return preview, nil
}
