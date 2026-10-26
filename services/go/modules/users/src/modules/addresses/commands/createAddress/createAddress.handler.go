package createaddress

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/addresses/models"
	"nantty/modules/users/src/modules/addresses/services"
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
		builder := tx.ShippingAddress.Create()
		if err := services.StorePhone[*ent.ShippingAddressCreate](builder, handler.Container.Settings.AddressPhoneKey, input.Phone); err != nil {
			return err
		}
		created, err = builder.
			SetAccountID(command.AccountId).SetLabel(input.Label).SetRecipientName(input.FullName).
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
	return services.AddressView{Address: created, Country: resolved.Country, Region: resolved.Region, Area: resolved.Area, City: resolved.City, Phone: input.Phone}, nil
}

func freeTextWhenUnstructured(resolved services.ResolvedGeo, text string) string {
	if resolved.Region != nil {
		return ""
	}
	return text
}
