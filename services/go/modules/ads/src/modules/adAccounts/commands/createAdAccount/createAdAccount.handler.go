package createadaccount

import (
	"context"
	"strings"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccountmember"
	"zudomart/modules/ads/src/modules/adAccounts/dtos"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

const maximumAdminAccountsPerUser = 10

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AdAccount, error) {
	deployed := handler.Container
	request := command.Request
	if err := services.RequirePayoutVerified(ctx, deployed.Verification, command.UserId.String()); err != nil {
		return dtos.AdAccount{}, err
	}
	linked, err := handler.resolveLinkedStore(ctx, command)
	if err != nil {
		return dtos.AdAccount{}, err
	}
	adminCount, err := deployed.Client.AdAccountMember.Query().Where(adaccountmember.UserID(command.UserId), adaccountmember.RoleEQ(adaccountmember.RoleAdmin)).Count(ctx)
	if err != nil {
		return dtos.AdAccount{}, err
	}
	if adminCount >= maximumAdminAccountsPerUser {
		return dtos.AdAccount{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "name", Message: "You can administer at most 10 ad accounts."}})
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	var created *ent.AdAccount
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		create := tx.AdAccount.Create().SetName(strings.TrimSpace(request.Name)).SetKind(adaccountKind(request.Kind)).SetOwnerUserID(command.UserId).SetCountryCode(strings.ToUpper(request.CountryCode)).
			SetCurrency(accountservices.CurrencyForCountry(request.CountryCode)).SetTimezone(request.Timezone).SetVerifiedBusiness(linked != nil && linked.GoldVerified)
		if linked != nil {
			create.SetStoreID(linked.StoreId)
		}
		account, err := create.Save(ctx)
		if err != nil {
			return err
		}
		created = account
		if err := tx.AdAccountMember.Create().SetAccountID(account.ID).SetUserID(command.UserId).SetRole(adaccountmember.RoleAdmin).SetIsOwner(true).Exec(ctx); err != nil {
			return err
		}
		return services.RecordActivityInTransaction(ctx, tx, account.ID, "account", account.ID.String(), actor, "Created the ad account", nil)
	})
	if ent.IsConstraintError(err) {
		return dtos.AdAccount{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "storeId", Message: "This store already has an ad account."}})
	}
	if err != nil {
		return dtos.AdAccount{}, err
	}
	return accountservices.PresentAccount(created, "admin", actor.Name, 0), nil
}
