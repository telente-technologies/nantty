package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/shippingprofile"
	"nantty/modules/orders/src/types"
	"nantty/platform/commerceports"
	"nantty/platform/money"
	"nantty/platform/usersdirectory"
)

func EnsureDefaultShippingProfile(ctx context.Context, deployed *container.Container, store commerceports.StoreAccess) (*ent.ShippingProfile, error) {
	profile, err := deployed.Client.ShippingProfile.Query().Where(shippingprofile.StoreID(store.StoreId), shippingprofile.IsDefault(true)).Only(ctx)
	if err == nil || !ent.IsNotFound(err) {
		return profile, err
	}
	created, err := deployed.Client.ShippingProfile.Create().SetStoreID(store.StoreId).SetName("Standard shipping").SetCurrency(string(store.Currency)).SetIsDefault(true).Save(ctx)
	if ent.IsConstraintError(err) {
		return deployed.Client.ShippingProfile.Query().Where(shippingprofile.StoreID(store.StoreId), shippingprofile.IsDefault(true)).Only(ctx)
	}
	return created, err
}

func ShippingProfileViewOf(ctx context.Context, deployed *container.Container, profile *ent.ShippingProfile) (types.ShippingProfileView, error) {
	rules, err := loadProfileRules(ctx, deployed, profile)
	if err != nil {
		return types.ShippingProfileView{}, err
	}
	regionIds, areaIds := []uuid.UUID{}, []uuid.UUID{}
	for _, zone := range rules.Zones {
		for _, destination := range zone.Destinations {
			if destination.RegionId != nil {
				regionIds = append(regionIds, *destination.RegionId)
			}
			if destination.AdminAreaId != nil {
				areaIds = append(areaIds, *destination.AdminAreaId)
			}
		}
	}
	regions, err := deployed.Users.DescribeRegions(ctx, regionIds)
	if err != nil {
		return types.ShippingProfileView{}, err
	}
	areas, err := deployed.Users.DescribeAdminAreas(ctx, areaIds)
	if err != nil {
		return types.ShippingProfileView{}, err
	}
	currency := money.CurrencyCode(profile.Currency)
	view := types.ShippingProfileView{Id: profile.ID.String(), Name: profile.Name, IsDefault: profile.IsDefault, Currency: profile.Currency, PricedPer: "order_group",
		Zones: []types.ShippingZoneView{}, Rules: []types.ShippingRuleView{}, UpdatedAt: profile.UpdatedAt}
	if profile.FreeShippingThresholdMinor != nil {
		view.FreeShippingThreshold = &money.Money{AmountMinor: *profile.FreeShippingThresholdMinor, Currency: currency}
	}
	for _, zone := range rules.Zones {
		zoneView := types.ShippingZoneView{Id: zone.Id.String(), Name: zone.Name, Destinations: []types.ShippingDestinationView{}}
		for _, destination := range zone.Destinations {
			zoneView.Destinations = append(zoneView.Destinations, destinationView(destination, regions, areas))
		}
		view.Zones = append(view.Zones, zoneView)
	}
	for _, rule := range rules.Rules {
		ruleType := "flat_fee"
		if rule.IsFree {
			ruleType = "free"
		}
		view.Rules = append(view.Rules, types.ShippingRuleView{Id: rule.Id.String(), ZoneId: rule.ZoneId.String(), Type: ruleType, Fee: money.Money{AmountMinor: rule.FeeMinor, Currency: currency}, Active: rule.Active})
	}
	return view, nil
}

func destinationView(destination ShippingDestinationRule, regions map[uuid.UUID]usersdirectory.GeoRegion, areas map[uuid.UUID]string) types.ShippingDestinationView {
	view := types.ShippingDestinationView{Level: "country", CountryCode: destination.CountryCode}
	if destination.RegionId != nil {
		identifier := destination.RegionId.String()
		view.RegionId, view.Level = &identifier, "state"
		if region, found := regions[*destination.RegionId]; found && region.Code != "" {
			code := region.Code
			view.StateCode = &code
		}
	}
	if destination.AdminAreaId != nil {
		identifier := destination.AdminAreaId.String()
		view.AdminAreaId, view.Level = &identifier, "lga"
		if name, found := areas[*destination.AdminAreaId]; found {
			view.LgaName = &name
		}
	}
	return view
}
