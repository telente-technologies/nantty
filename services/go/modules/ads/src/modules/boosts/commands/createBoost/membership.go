package createboost

import (
	"context"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccountmember"
)

func ensureOwnerMembership(ctx context.Context, tx *ent.Tx, account *ent.AdAccount, command Command) error {
	exists, err := tx.AdAccountMember.Query().Where(adaccountmember.AccountID(account.ID), adaccountmember.UserID(command.UserId)).Exist(ctx)
	if err != nil || exists {
		return err
	}
	return tx.AdAccountMember.Create().SetAccountID(account.ID).SetUserID(command.UserId).SetRole(adaccountmember.RoleAdmin).SetIsOwner(true).Exec(ctx)
}
