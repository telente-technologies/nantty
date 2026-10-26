package updateaddress

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/shippingaddress"
	"nantty/modules/users/src/modules/addresses/models"
	"nantty/modules/users/src/modules/addresses/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.AddressView, error) {
	var views []services.AddressView
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := services.LockAddressesOfAccountInTransaction(ctx, tx, command.AccountId); err != nil {
			return err
		}
		current, err := tx.ShippingAddress.Query().Where(shippingaddress.ID(command.AddressId), shippingaddress.AccountID(command.AccountId)).Only(ctx)
		if ent.IsNotFound(err) {
			return services.ErrAddressNotFound
		}
		if err != nil {
			return err
		}
		update := tx.ShippingAddress.UpdateOne(current)
		resolved, err := handler.applyPatch(ctx, tx, update, current, command.Patch)
		if err != nil {
			return err
		}
		saved, err := update.Save(ctx)
		if err != nil {
			return err
		}
		if saved.IsDefault {
			if err := services.ClearDefaultFlagExceptInTransaction(ctx, tx, command.AccountId, saved.ID); err != nil {
				return err
			}
		}
		phone, err := services.OpenPhone(handler.Container.Settings.AddressPhoneKey, saved)
		if err != nil {
			return err
		}
		views = []services.AddressView{{Address: saved, Country: resolved.Country, Region: resolved.Region, Area: resolved.Area, City: resolved.City, Phone: phone}}
		return nil
	})
	if err != nil {
		return services.AddressView{}, err
	}
	return views[0], nil
}

func (handler Handler) applyPatch(ctx context.Context, tx *ent.Tx, update *ent.ShippingAddressUpdateOne, current *ent.ShippingAddress, patch models.AddressPatch) (services.ResolvedGeo, error) {
	applyScalarFields(update, patch)
	if patch.Phone != nil {
		if err := services.StorePhone[*ent.ShippingAddressUpdateOne](update, handler.Container.Settings.AddressPhoneKey, *patch.Phone); err != nil {
			return services.ResolvedGeo{}, err
		}
		if handler.Container.Settings.AddressPhoneKey == nil {
			update.ClearPhoneSealed()
		}
	}
	resolved, err := handler.resolveGeoAfterPatch(ctx, tx, current, patch)
	if err != nil {
		return resolved, err
	}
	postalCode := current.PostalCode
	if patch.PostalCode != nil {
		postalCode = *patch.PostalCode
	}
	if !services.ValidatePostalCodeForCountry(resolved.Country.Code, postalCode, resolved.Country.PostalCodeRequired) {
		return resolved, services.ErrPostalCodeInvalid
	}
	if patch.Geo != nil {
		regionId, areaId, cityId := services.GeoColumnsFromResolved(resolved)
		update.SetCountryCode(resolved.Country.Code)
		setOrClear(regionId, update.SetRegionID, update.ClearRegionID)
		setOrClear(areaId, update.SetAdminAreaID, update.ClearAdminAreaID)
		setOrClear(cityId, update.SetCityID, update.ClearCityID)
		update.SetFreeTextCity(freeText(resolved, patch.Geo.FreeTextCity)).SetFreeTextState(freeText(resolved, patch.Geo.FreeTextState))
	}
	return resolved, nil
}

func (handler Handler) resolveGeoAfterPatch(ctx context.Context, tx *ent.Tx, current *ent.ShippingAddress, patch models.AddressPatch) (services.ResolvedGeo, error) {
	if patch.Geo != nil {
		return services.ResolveGeoSelection(ctx, tx.Client(), *patch.Geo)
	}
	views, err := services.BuildAddressViews(ctx, tx.Client(), handler.Container.Settings.AddressPhoneKey, []*ent.ShippingAddress{current})
	if err != nil {
		return services.ResolvedGeo{}, err
	}
	return services.ResolvedGeo{Country: views[0].Country, Region: views[0].Region, Area: views[0].Area, City: views[0].City}, nil
}

func applyScalarFields(update *ent.ShippingAddressUpdateOne, patch models.AddressPatch) {
	if patch.Label != nil {
		update.SetLabel(*patch.Label)
	}
	if patch.FullName != nil {
		update.SetRecipientName(*patch.FullName)
	}
	if patch.Line1 != nil {
		update.SetLine1(*patch.Line1)
	}
	if patch.Line2 != nil {
		update.SetLine2(*patch.Line2)
	}
	if patch.PostalCode != nil {
		update.SetPostalCode(*patch.PostalCode)
	}
	if patch.Details != nil {
		update.SetDetails(*patch.Details)
	}
	if patch.IsDefault != nil && *patch.IsDefault {
		update.SetIsDefault(true)
	}
}

func freeText(resolved services.ResolvedGeo, text string) string {
	if resolved.Region != nil {
		return ""
	}
	return text
}

func setOrClear(identifier *uuid.UUID, set func(uuid.UUID) *ent.ShippingAddressUpdateOne, clear func() *ent.ShippingAddressUpdateOne) {
	if identifier != nil {
		set(*identifier)
		return
	}
	clear()
}
