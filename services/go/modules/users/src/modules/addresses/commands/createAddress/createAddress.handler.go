package createaddress

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/modules/addresses/models"
	"zudomart/modules/users/src/modules/addresses/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.AddressView, error) {
	input := command.Input
	resolved, err := services.ResolveGeoSelection(ctx, handler.Container.Client, input.Geo)
	if err != nil {
		return services.AddressView{}, err
	}
	if !services.ValidatePostalCodeForCountry(resolved.Country.Code, input.PostalCode, resolved.Country.PostalCodeRequired) {
		return services.AddressView{}, services.ErrPostalCodeInvalid
	}
	var created *ent.ShippingAddress
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := services.LockAddressesOfAccountInTransaction(ctx, tx, command.AccountId)
		if err != nil {
			return err
		}
		if len(existing) >= models.MaximumAddressesPerAccount {
			return services.ErrAddressLimitReached
		}
		regionId, areaId, cityId := services.GeoColumnsFromResolved(resolved)
		created, err = tx.ShippingAddress.Create().
			SetAccountID(command.AccountId).SetLabel(input.Label).SetRecipientName(input.FullName).SetPhone(input.Phone).
			SetLine1(input.Line1).SetLine2(input.Line2).SetPostalCode(input.PostalCode).SetDetails(input.Details).
			SetCountryCode(resolved.Country.Code).SetNillableRegionID(regionId).SetNillableAdminAreaID(areaId).SetNillableCityID(cityId).
			SetFreeTextCity(freeTextWhenUnstructured(resolved, input.Geo.FreeTextCity)).SetFreeTextState(freeTextWhenUnstructured(resolved, input.Geo.FreeTextState)).
			SetIsDefault(input.IsDefault || len(existing) == 0).Save(ctx)
		if err != nil {
			return err
		}
		if created.IsDefault {
			return services.ClearDefaultFlagExceptInTransaction(ctx, tx, command.AccountId, created.ID)
		}
		return nil
	})
	if err != nil {
		return services.AddressView{}, err
	}
	return services.AddressView{Address: created, Country: resolved.Country, Region: resolved.Region, Area: resolved.Area, City: resolved.City}, nil
}

func freeTextWhenUnstructured(resolved services.ResolvedGeo, text string) string {
	if resolved.Region != nil {
		return ""
	}
	return text
}
