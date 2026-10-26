package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionofferclaim"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionofferlink"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionoffersend"
)

const maximumOfferSendsConsideredForDiscounts = 20

type VerificationOfferDiscountView struct {
	LinkId         string            `json:"linkId"`
	Token          string            `json:"token"`
	Plans          []OfferPlanLabel  `json:"plans"`
	Discount       OfferDiscountView `json:"discount"`
	DurationCycles int               `json:"durationCycles"`
	ExpiresAt      *time.Time        `json:"expiresAt"`
	SentAt         time.Time         `json:"sentAt"`
}

type VerificationBundleDiscountView struct {
	PercentOff int64 `json:"percentOff"`
}

type VerificationDiscountsView struct {
	Offers           []VerificationOfferDiscountView `json:"offers"`
	YearlyPercentOff int64                           `json:"yearlyPercentOff"`
	Bundle           *VerificationBundleDiscountView `json:"bundle"`
}

func (billing Billing) VerificationDiscounts(ctx context.Context, userId string) (VerificationDiscountsView, error) {
	view := VerificationDiscountsView{Offers: []VerificationOfferDiscountView{}}
	profile, found, err := billing.Container.Identity.FindActingProfile(ctx, userId)
	if err != nil {
		return view, err
	}
	profileType := constants.ProfilePersonal
	if found {
		profileType = profile.ProfileType
	}
	if _, sold := verificationPlanCodes[profileType]; !sold {
		return view, nil
	}
	_, pricing := billing.rules(ctx)
	view.YearlyPercentOff = pricing.Pricing.YearlyDiscountBps / 100
	client := billing.Container.Client(billing.Container.Resources.Database)
	if profileType != constants.ProfilePersonal {
		bundle, err := billing.bundleDiscountAvailableTo(ctx, client, userId, pricing.Pricing.BundleDiscountBps, pricing.Pricing.BundleMaximumBusinesses)
		if err != nil {
			return view, err
		}
		view.Bundle = bundle
	}
	view.Offers, err = billing.unclaimedOffersSentToAccount(ctx, client, userId, profileType)
	return view, err
}

func (billing Billing) bundleDiscountAvailableTo(ctx context.Context, client *ent.Client, userId string, discountBps int64, maximumBusinesses int) (*VerificationBundleDiscountView, error) {
	if discountBps <= 0 {
		return nil, nil
	}
	hasBlue, err := billing.ownerHasLiveBlue(ctx, client, userId)
	if err != nil || !hasBlue {
		return nil, err
	}
	bundled, err := client.Subscription.Query().Where(subscription.OwnerUserID(userId), subscription.DiscountKindEQ(subscription.DiscountKindBundle), subscription.StatusIn(liveStatuses()...)).Count(ctx)
	if err != nil || bundled >= maximumBusinesses {
		return nil, err
	}
	return &VerificationBundleDiscountView{PercentOff: discountBps / 100}, nil
}

func (billing Billing) unclaimedOffersSentToAccount(ctx context.Context, client *ent.Client, userId, profileType string) ([]VerificationOfferDiscountView, error) {
	offers := []VerificationOfferDiscountView{}
	signals, found, err := billing.Container.Identity.ReadAccountSignals(ctx, userId)
	if err != nil || !found || !signals.EmailVerified || signals.Email == "" {
		return offers, err
	}
	sends, err := client.SubscriptionOfferSend.Query().Where(subscriptionoffersend.RecipientEmailEqualFold(signals.Email)).
		Order(ent.Desc(subscriptionoffersend.FieldCreatedAt), ent.Desc(subscriptionoffersend.FieldID)).Limit(maximumOfferSendsConsideredForDiscounts).All(ctx)
	if err != nil || len(sends) == 0 {
		return offers, err
	}
	linkIds, sentAtByLink := []uuid.UUID{}, map[string]time.Time{}
	for _, send := range sends {
		if _, seen := sentAtByLink[send.LinkID]; seen {
			continue
		}
		if id, err := uuid.Parse(send.LinkID); err == nil {
			linkIds, sentAtByLink[send.LinkID] = append(linkIds, id), send.CreatedAt
		}
	}
	links, err := client.SubscriptionOfferLink.Query().Where(subscriptionofferlink.IDIn(linkIds...)).All(ctx)
	if err != nil {
		return offers, err
	}
	claimedLinkIds, err := billing.offerLinksClaimedByAccount(ctx, client, userId, linkIds)
	if err != nil {
		return offers, err
	}
	now := billing.Container.Now().UTC()
	linksById := map[string]*ent.SubscriptionOfferLink{}
	for _, link := range links {
		linksById[link.ID.String()] = link
	}
	for _, id := range linkIds {
		link := linksById[id.String()]
		if link == nil || claimedLinkIds[link.ID.String()] || OfferLinkStatus(link, now) != OfferStatusActive {
			continue
		}
		plans := eligibleOfferPlansFor(link, profileType)
		if len(plans) == 0 {
			continue
		}
		offers = append(offers, VerificationOfferDiscountView{
			LinkId: link.ID.String(), Token: billing.offerLinkTokenFromSalt(link.TokenSalt), Plans: offerPlanLabels(plans), Discount: offerDiscountViewOf(offerTermsOf(link)),
			DurationCycles: link.DurationCycles, ExpiresAt: link.ExpiresAt, SentAt: sentAtByLink[link.ID.String()],
		})
	}
	return offers, nil
}

func (billing Billing) offerLinksClaimedByAccount(ctx context.Context, client *ent.Client, userId string, linkIds []uuid.UUID) (map[string]bool, error) {
	ids := make([]string, 0, len(linkIds))
	for _, id := range linkIds {
		ids = append(ids, id.String())
	}
	claims, err := client.SubscriptionOfferClaim.Query().Where(subscriptionofferclaim.LinkIDIn(ids...), subscriptionofferclaim.OwnerUserID(userId),
		subscriptionofferclaim.StatusIn(subscriptionofferclaim.StatusReserved, subscriptionofferclaim.StatusRedeemed)).All(ctx)
	claimed := map[string]bool{}
	for _, claim := range claims {
		claimed[claim.LinkID] = true
	}
	return claimed, err
}
