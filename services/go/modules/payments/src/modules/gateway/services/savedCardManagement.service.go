package services

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/billingauthorization"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/platform/httpserver"
)

var ErrSavedCardNotFound = httpserver.NewApiError(http.StatusNotFound, "SAVED_CARD_NOT_FOUND", "Payment method not found.")

type SavedBillingCardView struct {
	Id          string     `json:"id"`
	Brand       string     `json:"brand"`
	Last4       string     `json:"last4"`
	ExpiryMonth int        `json:"expiryMonth"`
	ExpiryYear  int        `json:"expiryYear"`
	Label       string     `json:"label"`
	Usable      bool       `json:"usable"`
	RevokedAt   *time.Time `json:"revokedAt,omitempty"`
}

func (gateway *PaymentGateway) SupportsRecurringCardCurrency(currency string) bool {
	if gateway == nil || gateway.Container == nil {
		return false
	}
	provider, err := gateway.Container.DefaultProvider()
	if err != nil || !provider.SupportsCurrency(strings.ToUpper(strings.TrimSpace(currency))) {
		return false
	}
	_, err = gateway.Container.SavedCards(provider.Name())
	return err == nil
}

func (gateway *PaymentGateway) ListBillingAuthorizations(ctx context.Context, userId string) ([]SavedBillingCardView, error) {
	rows, err := gateway.Container.Client(gateway.Container.Resources.Database).BillingAuthorization.Query().
		Where(billingauthorization.UserID(userId)).Order(ent.Desc(billingauthorization.FieldCreatedAt)).Limit(50).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]SavedBillingCardView, 0, len(rows))
	for _, row := range rows {
		views = append(views, SavedBillingCardView{
			Id: row.ID.String(), Brand: row.CardBrand, Last4: row.CardLast4, ExpiryMonth: row.CardExpiryMonth, ExpiryYear: row.CardExpiryYear,
			Label: SavedCardLabel(row.CardBrand, row.CardLast4), Usable: row.RevokedAt == nil, RevokedAt: row.RevokedAt,
		})
	}
	return views, nil
}

func (gateway *PaymentGateway) RevokeBillingAuthorization(ctx context.Context, userId, authorizationId, reason string) (SavedBillingCardView, error) {
	id, err := uuid.Parse(authorizationId)
	if err != nil {
		return SavedBillingCardView{}, ErrSavedCardNotFound
	}
	var view SavedBillingCardView
	err = databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		row, err := client.BillingAuthorization.Query().Where(billingauthorization.ID(id), billingauthorization.UserID(userId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return ErrSavedCardNotFound
		}
		if err != nil {
			return err
		}
		now := gateway.Container.Now().UTC()
		if row.RevokedAt == nil {
			if row, err = row.Update().SetRevokedAt(now).Save(ctx); err != nil {
				return err
			}
			if reason == "" {
				reason = "payment_method_removed"
			}
			if err := gateway.notifyBillingAuthorizationRevokedObservers(ctx, transaction, models.BillingAuthorizationRevoked{
				OwnerUserId: userId, AuthorizationId: row.ID.String(), Reason: reason, RevokedAt: now,
			}); err != nil {
				return err
			}
			if err := gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "billingAuthorization.revoked", row.ID.String(), now, map[string]any{
				"accountId": userId, "authorizationId": row.ID.String(), "cardLabel": SavedCardLabel(row.CardBrand, row.CardLast4), "reason": reason,
			}); err != nil {
				return err
			}
		}
		view = SavedBillingCardView{
			Id: row.ID.String(), Brand: row.CardBrand, Last4: row.CardLast4, ExpiryMonth: row.CardExpiryMonth, ExpiryYear: row.CardExpiryYear,
			Label: SavedCardLabel(row.CardBrand, row.CardLast4), Usable: false, RevokedAt: row.RevokedAt,
		}
		return nil
	})
	return view, err
}
