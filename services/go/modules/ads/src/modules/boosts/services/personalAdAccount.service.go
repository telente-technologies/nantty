package services

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccountmember"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
)

func EnsurePersonalBoostAccount(ctx context.Context, client *ent.Client, userId uuid.UUID, currency, countryCode string) (*ent.AdAccount, error) {
	existing, err := FindPersonalBoostAccount(ctx, client, userId, currency)
	if err != nil || existing != nil {
		return existing, err
	}
	if len(countryCode) != 2 {
		countryCode = accountservices.CountryForCurrency(currency)
	}
	created, err := client.AdAccount.Create().SetName("Boosted posts").SetKind("personal").SetOwnerUserID(userId).SetCountryCode(countryCode).SetCurrency(currency).Save(ctx)
	if err != nil {
		return nil, err
	}
	err = client.AdAccountMember.Create().SetAccountID(created.ID).SetUserID(userId).SetRole(adaccountmember.RoleAdmin).SetIsOwner(true).
		OnConflictColumns(adaccountmember.FieldAccountID, adaccountmember.FieldUserID).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return created, nil
}
