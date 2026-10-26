package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/sellerverification"
	"nantty/platform/events"
)

func (gateway *PaymentGateway) RecordSellerVerification(ctx context.Context, accountId, eventId string, verifiedAt time.Time) error {
	return gateway.applySellerVerificationEvent(ctx, accountId, eventId, verifiedAt, false)
}

func (gateway *PaymentGateway) RevokeSellerVerification(ctx context.Context, accountId, eventId string, revokedAt time.Time) error {
	return gateway.applySellerVerificationEvent(ctx, accountId, eventId, revokedAt, true)
}

func (gateway *PaymentGateway) applySellerVerificationEvent(ctx context.Context, accountId, eventId string, at time.Time, revoke bool) error {
	if accountId == "" {
		return fmt.Errorf("%w: seller verification needs an account id", events.ErrPoisonMessage)
	}
	at = at.UTC()
	if at.IsZero() {
		at = gateway.Container.Now().UTC()
	}
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		create := client.SellerVerification.Create().SetAccountID(accountId).SetVerifiedAt(at).SetCreatedAt(gateway.Container.Now())
		if revoke {
			create.SetSource("businessVerification.revoked").SetRevokedAt(at).SetRevokedEventID(eventId)
		} else {
			create.SetSource("businessVerification.approved").SetEventID(eventId)
		}
		err := create.OnConflictColumns(sellerverification.FieldAccountID).DoNothing().Exec(ctx)
		if err == nil || !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		row, err := client.SellerVerification.Query().Where(sellerverification.AccountID(accountId)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if !isNewerSellerVerificationEvent(row, eventId, at) {
			return nil
		}
		update := row.Update()
		if revoke {
			update.SetRevokedAt(at).SetRevokedEventID(eventId)
		} else {
			update.SetSource("businessVerification.approved").SetEventID(eventId).SetVerifiedAt(at).ClearRevokedAt().SetRevokedEventID("")
		}
		return update.Exec(ctx)
	})
}

func isNewerSellerVerificationEvent(row *ent.SellerVerification, eventId string, at time.Time) bool {
	if eventId != "" && (row.EventID == eventId || row.RevokedEventID == eventId) {
		return false
	}
	latest := row.VerifiedAt
	if row.RevokedAt != nil && row.RevokedAt.After(latest) {
		latest = *row.RevokedAt
	}
	return at.After(latest)
}
