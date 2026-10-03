package services

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"zudomart/modules/payments/src/generated/ent/connectedaccount"
)

func (gateway *PaymentGateway) applyPayoutAccountStatusInTransaction(ctx context.Context, transaction *sql.Tx, accountId uuid.UUID) error {
	client := gateway.Container.Client(transaction)
	account, err := client.ConnectedAccount.Query().Where(connectedaccount.ID(accountId)).ForUpdate().Only(ctx)
	if err != nil {
		return err
	}
	complete := PayoutAccountComplete(account, gateway.Container.Settings.EscrowMode == "e1")
	now := gateway.Container.Now().UTC()
	data := map[string]any{"userId": account.UserID, "payoutAccountId": account.ID.String(), "roles": account.Roles}
	switch {
	case complete && account.VerificationStatus != connectedaccount.VerificationStatusVerified:
		if err := account.Update().SetStatus(connectedaccount.StatusCreated).SetLastError("").SetProviderAccountID(account.RecipientCode).
			SetVerificationStatus(connectedaccount.VerificationStatusVerified).SetVerificationStatusChangedAt(now).AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		if account.Status != connectedaccount.StatusCreated {
			if err := gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payoutAccount.created", account.ID.String(), now, data); err != nil {
				return err
			}
		}
		data["verificationStatus"] = "verified"
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payoutAccount.verified", account.ID.String(), now, data)
	case !complete && account.VerificationStatus == connectedaccount.VerificationStatusVerified:
		return account.Update().SetVerificationStatus(connectedaccount.VerificationStatusInProgress).SetVerificationStatusChangedAt(now).AddVersion(1).Exec(ctx)
	case !complete && account.RecipientCode != "" && account.Status != connectedaccount.StatusCreated:
		if err := account.Update().SetStatus(connectedaccount.StatusCreated).SetProviderAccountID(account.RecipientCode).SetVerificationStatus(connectedaccount.VerificationStatusInProgress).AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payoutAccount.created", account.ID.String(), now, data)
	}
	return nil
}
