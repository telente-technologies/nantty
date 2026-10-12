package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionofferclaim"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionoffersend"
	"zudomart/modules/subscriptions/src/models"
)

const OfferSentEvent = "subscriptionOffer.sent"

type OfferSendView struct {
	Id             string    `json:"id"`
	RecipientEmail string    `json:"recipientEmail"`
	Note           string    `json:"note"`
	SentByStaffId  string    `json:"sentByStaffId"`
	SentAt         time.Time `json:"sentAt"`
}

type OfferClaimView struct {
	Id             string     `json:"id"`
	AccountId      string     `json:"accountId"`
	ProfileId      string     `json:"profileId"`
	Status         string     `json:"status"`
	SubscriptionId string     `json:"subscriptionId,omitempty"`
	ReservedUntil  time.Time  `json:"reservedUntil"`
	RedeemedAt     *time.Time `json:"redeemedAt"`
	ClaimedAt      time.Time  `json:"claimedAt"`
}

func convertOfferSend(row *ent.SubscriptionOfferSend) OfferSendView {
	return OfferSendView{Id: row.ID.String(), RecipientEmail: row.RecipientEmail, Note: row.Note, SentByStaffId: row.SentByStaffID, SentAt: row.CreatedAt}
}

func convertOfferClaim(row *ent.SubscriptionOfferClaim) OfferClaimView {
	return OfferClaimView{
		Id: row.ID.String(), AccountId: row.OwnerUserID, ProfileId: row.ProfileID, Status: row.Status.String(), SubscriptionId: row.SubscriptionID,
		ReservedUntil: row.ReservedUntil, RedeemedAt: row.RedeemedAt, ClaimedAt: row.CreatedAt,
	}
}

func (billing Billing) attachOfferActivity(ctx context.Context, views []OfferLinkView) ([]OfferLinkView, error) {
	if len(views) == 0 {
		return views, nil
	}
	ids, positions := make([]string, 0, len(views)), map[string]int{}
	for index, view := range views {
		ids, positions[view.Id] = append(ids, view.Id), index
	}
	client := billing.Container.Client(billing.Container.Resources.Database)
	sends, err := client.SubscriptionOfferSend.Query().Where(subscriptionoffersend.LinkIDIn(ids...)).Order(ent.Desc(subscriptionoffersend.FieldCreatedAt), ent.Desc(subscriptionoffersend.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, send := range sends {
		views[positions[send.LinkID]].Sends = append(views[positions[send.LinkID]].Sends, convertOfferSend(send))
	}
	claims, err := client.SubscriptionOfferClaim.Query().Where(subscriptionofferclaim.LinkIDIn(ids...)).Order(ent.Desc(subscriptionofferclaim.FieldCreatedAt), ent.Desc(subscriptionofferclaim.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, claim := range claims {
		views[positions[claim.LinkID]].Claims = append(views[positions[claim.LinkID]].Claims, convertOfferClaim(claim))
	}
	return views, nil
}

func (billing Billing) SendOfferLink(ctx context.Context, linkId, staffId, note string, recipientEmails []string) ([]OfferSendView, error) {
	id, err := uuid.Parse(linkId)
	if err != nil {
		return nil, ErrOfferLinkNotFound
	}
	sent := make([]OfferSendView, 0, len(recipientEmails))
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := billing.Container.Client(transaction)
		link, err := client.SubscriptionOfferLink.Get(ctx, id)
		if ent.IsNotFound(err) {
			return ErrOfferLinkNotFound
		}
		if err != nil {
			return err
		}
		if OfferLinkStatus(link, billing.Container.Now().UTC()) != OfferStatusActive {
			return ErrOfferLinkNotActive
		}
		claimUrl := billing.offerClaimUrl(billing.offerLinkTokenFromSalt(link.TokenSalt))
		for _, email := range recipientEmails {
			row, err := client.SubscriptionOfferSend.Create().SetID(uuid.Must(uuid.NewV7())).SetLinkID(link.ID.String()).SetRecipientEmail(email).SetNote(note).
				SetSentByStaffID(staffId).SetCreatedAt(billing.Container.Now().UTC()).Save(ctx)
			if err != nil {
				return err
			}
			if err := billing.emit(ctx, transaction, OfferSentEvent, row.ID.String(), billing.offerSentEventData(link, row, claimUrl)); err != nil {
				return err
			}
			sent = append(sent, convertOfferSend(row))
		}
		return nil
	})
	return sent, err
}

func (billing Billing) offerSentEventData(link *ent.SubscriptionOfferLink, send *ent.SubscriptionOfferSend, claimUrl string) map[string]any {
	terms := offerTermsOf(link)
	data := map[string]any{
		"sendId": send.ID.String(), "linkId": link.ID.String(), "recipientEmail": send.RecipientEmail, "note": send.Note, "claimUrl": claimUrl,
		"discountKind": terms.Kind, "plans": offerPlanLabels(link.PlanCodes), "durationCycles": link.DurationCycles, "expiresAt": isoTime(link.ExpiresAt),
		"singleUse": link.SingleUse, "sentByStaffId": send.SentByStaffID,
	}
	if terms.Kind == models.OfferFixedAmount {
		data["amountOff"] = money(terms.AmountOffMinor, terms.Currency)
	} else {
		data["percentOff"] = terms.PercentOff
	}
	return data
}
