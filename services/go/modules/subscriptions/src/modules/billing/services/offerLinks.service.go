package services

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionofferlink"
	"nantty/modules/subscriptions/src/models"
	"nantty/platform/httpserver"
)

var (
	ErrOfferLinkNotFound  = httpserver.NewApiError(http.StatusNotFound, "OFFER_LINK_NOT_FOUND", "This offer link was not found.")
	ErrOfferLinkNotActive = httpserver.NewApiError(http.StatusConflict, "OFFER_LINK_NOT_ACTIVE", "This offer link is revoked, expired or fully claimed, so it can't be sent.")
)

const (
	OfferStatusActive       = "active"
	OfferStatusExpired      = "expired"
	OfferStatusRevoked      = "revoked"
	OfferStatusFullyClaimed = "fully_claimed"
)

type NewOfferLink struct {
	Label          string
	PlanCodes      []string
	Terms          models.OfferTerms
	SingleUse      bool
	MaxClaims      int
	DurationCycles int
	ExpiresAt      *time.Time
	StaffId        string
}

type OfferPlanLabel struct {
	PlanCode  string `json:"planCode"`
	PlanLabel string `json:"planLabel"`
}

type OfferDiscountView struct {
	Kind       string         `json:"kind"`
	PercentOff int64          `json:"percentOff,omitempty"`
	AmountOff  map[string]any `json:"amountOff,omitempty"`
}

type OfferLinkView struct {
	Id               string            `json:"id"`
	Label            string            `json:"label"`
	Url              string            `json:"url"`
	Status           string            `json:"status"`
	Plans            []OfferPlanLabel  `json:"plans"`
	Discount         OfferDiscountView `json:"discount"`
	SingleUse        bool              `json:"singleUse"`
	MaxClaims        int               `json:"maxClaims"`
	ClaimedCount     int               `json:"claimedCount"`
	RedeemedCount    int               `json:"redeemedCount"`
	DurationCycles   int               `json:"durationCycles"`
	ExpiresAt        *time.Time        `json:"expiresAt"`
	RevokedAt        *time.Time        `json:"revokedAt"`
	CreatedByStaffId string            `json:"createdByStaffId"`
	CreatedAt        time.Time         `json:"createdAt"`
	Sends            []OfferSendView   `json:"sends"`
	Claims           []OfferClaimView  `json:"claims"`
}

func offerTermsOf(link *ent.SubscriptionOfferLink) models.OfferTerms {
	return models.OfferTerms{Kind: link.DiscountKind.String(), PercentOff: link.PercentOff, AmountOffMinor: link.AmountOffMinor, Currency: link.AmountOffCurrency}
}

func offerDiscountViewOf(terms models.OfferTerms) OfferDiscountView {
	if terms.Kind == models.OfferFixedAmount {
		return OfferDiscountView{Kind: terms.Kind, AmountOff: money(terms.AmountOffMinor, terms.Currency)}
	}
	return OfferDiscountView{Kind: terms.Kind, PercentOff: terms.PercentOff}
}

func offerPlanLabels(planCodes []string) []OfferPlanLabel {
	labels := make([]OfferPlanLabel, 0, len(planCodes))
	for _, code := range planCodes {
		labels = append(labels, OfferPlanLabel{PlanCode: code, PlanLabel: PlanLabel(code)})
	}
	return labels
}

func OfferLinkStatus(link *ent.SubscriptionOfferLink, now time.Time) string {
	switch {
	case link.RevokedAt != nil:
		return OfferStatusRevoked
	case link.ExpiresAt != nil && !now.Before(*link.ExpiresAt):
		return OfferStatusExpired
	case link.ClaimedCount >= link.MaxClaims:
		return OfferStatusFullyClaimed
	}
	return OfferStatusActive
}

func (billing Billing) convertOfferLink(link *ent.SubscriptionOfferLink) OfferLinkView {
	return OfferLinkView{
		Id: link.ID.String(), Label: link.Label, Url: billing.offerClaimUrl(billing.offerLinkTokenFromSalt(link.TokenSalt)), Status: OfferLinkStatus(link, billing.Container.Now().UTC()),
		Plans: offerPlanLabels(link.PlanCodes), Discount: offerDiscountViewOf(offerTermsOf(link)), SingleUse: link.SingleUse, MaxClaims: link.MaxClaims,
		ClaimedCount: link.ClaimedCount, RedeemedCount: link.RedeemedCount, DurationCycles: link.DurationCycles, ExpiresAt: link.ExpiresAt, RevokedAt: link.RevokedAt,
		CreatedByStaffId: link.CreatedByStaffID, CreatedAt: link.CreatedAt, Sends: []OfferSendView{}, Claims: []OfferClaimView{},
	}
}

func (billing Billing) CreateOfferLink(ctx context.Context, request NewOfferLink) (OfferLinkView, error) {
	salt, err := newOfferLinkTokenSalt()
	if err != nil {
		return OfferLinkView{}, err
	}
	maxClaims := request.MaxClaims
	if request.SingleUse {
		maxClaims = 1
	}
	link, err := billing.Container.Client(billing.Container.Resources.Database).SubscriptionOfferLink.Create().SetID(uuid.Must(uuid.NewV7())).
		SetTokenSalt(salt).SetTokenHash(HashOfferLinkToken(billing.offerLinkTokenFromSalt(salt))).SetLabel(request.Label).SetPlanCodes(request.PlanCodes).
		SetDiscountKind(subscriptionofferlink.DiscountKind(request.Terms.Kind)).SetPercentOff(request.Terms.PercentOff).SetAmountOffMinor(request.Terms.AmountOffMinor).
		SetAmountOffCurrency(request.Terms.Currency).SetSingleUse(request.SingleUse).SetMaxClaims(maxClaims).SetDurationCycles(request.DurationCycles).
		SetNillableExpiresAt(request.ExpiresAt).SetCreatedByStaffID(request.StaffId).SetCreatedAt(billing.Container.Now().UTC()).Save(ctx)
	if err != nil {
		return OfferLinkView{}, err
	}
	return billing.convertOfferLink(link), nil
}

func (billing Billing) FindOfferLinkView(ctx context.Context, linkId string) (OfferLinkView, error) {
	id, err := uuid.Parse(linkId)
	if err != nil {
		return OfferLinkView{}, ErrOfferLinkNotFound
	}
	link, err := billing.Container.Client(billing.Container.Resources.Database).SubscriptionOfferLink.Get(ctx, id)
	if ent.IsNotFound(err) {
		return OfferLinkView{}, ErrOfferLinkNotFound
	}
	if err != nil {
		return OfferLinkView{}, err
	}
	views, err := billing.attachOfferActivity(ctx, []OfferLinkView{billing.convertOfferLink(link)})
	if err != nil {
		return OfferLinkView{}, err
	}
	return views[0], nil
}

func (billing Billing) ListOfferLinks(ctx context.Context, limit int) ([]OfferLinkView, error) {
	links, err := billing.Container.Client(billing.Container.Resources.Database).SubscriptionOfferLink.Query().Order(ent.Desc(subscriptionofferlink.FieldCreatedAt), ent.Desc(subscriptionofferlink.FieldID)).Limit(limit).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]OfferLinkView, 0, len(links))
	for _, link := range links {
		views = append(views, billing.convertOfferLink(link))
	}
	return billing.attachOfferActivity(ctx, views)
}

func (billing Billing) RevokeOfferLink(ctx context.Context, linkId, staffId string) (OfferLinkView, error) {
	id, err := uuid.Parse(linkId)
	if err != nil {
		return OfferLinkView{}, ErrOfferLinkNotFound
	}
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := billing.Container.Client(transaction).SubscriptionOfferLink.Update().Where(subscriptionofferlink.ID(id), subscriptionofferlink.RevokedAtIsNil()).
			SetRevokedAt(billing.Container.Now().UTC()).SetRevokedByStaffID(staffId).Save(ctx)
		return err
	})
	if err != nil {
		return OfferLinkView{}, err
	}
	return billing.FindOfferLinkView(ctx, linkId)
}
