package createboost

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccount"
	"zudomart/modules/ads/src/generated/ent/adaccountmember"
	"zudomart/modules/ads/src/generated/ent/predicate"
)

func adAccountOwnedBy(userId uuid.UUID, currency string) predicate.AdAccount {
	return adaccount.And(adaccount.OwnerUserID(userId), adaccount.CurrencyEQ(currency), adaccount.KindEQ(adaccount.KindPersonal), adaccount.StatusEQ(adaccount.StatusActive))
}

func ensureOwnerMembership(ctx context.Context, tx *ent.Tx, account *ent.AdAccount, command Command) error {
	exists, err := tx.AdAccountMember.Query().Where(adaccountmember.AccountID(account.ID), adaccountmember.UserID(command.UserId)).Exist(ctx)
	if err != nil || exists {
		return err
	}
	return tx.AdAccountMember.Create().SetAccountID(account.ID).SetUserID(command.UserId).SetRole(adaccountmember.RoleAdmin).SetIsOwner(true).Exec(ctx)
}
