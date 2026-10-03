package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/shippingdestination"
	"zudomart/modules/orders/src/generated/ent/shippingprofile"
	"zudomart/modules/orders/src/generated/ent/shippingrule"
	"zudomart/modules/orders/src/generated/ent/shippingzone"
)

func LoadShippingProfileRules(ctx context.Context, deployed *container.Container, storeIds []uuid.UUID) (map[uuid.UUID]*ShippingProfileRules, error) {
	profiles, err := deployed.Client.ShippingProfile.Query().Where(shippingprofile.StoreIDIn(storeIds...), shippingprofile.Active(true)).
		Order(ent.Desc(shippingprofile.FieldIsDefault), ent.Asc(shippingprofile.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	chosen := map[uuid.UUID]*ent.ShippingProfile{}
	for _, profile := range profiles {
		if chosen[profile.StoreID] == nil {
			chosen[profile.StoreID] = profile
		}
	}
	result := map[uuid.UUID]*ShippingProfileRules{}
	for storeId, profile := range chosen {
		rules, err := loadProfileRules(ctx, deployed, profile)
		if err != nil {
			return nil, err
		}
		result[storeId] = rules
	}
	return result, nil
}

func loadProfileRules(ctx context.Context, deployed *container.Container, profile *ent.ShippingProfile) (*ShippingProfileRules, error) {
	zones, err := deployed.Client.ShippingZone.Query().Where(shippingzone.ProfileID(profile.ID)).All(ctx)
	if err != nil {
		return nil, err
	}
	zoneIds := make([]uuid.UUID, 0, len(zones))
	for _, zone := range zones {
		zoneIds = append(zoneIds, zone.ID)
	}
	destinations, err := deployed.Client.ShippingDestination.Query().Where(shippingdestination.ZoneIDIn(zoneIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	feeRules, err := deployed.Client.ShippingRule.Query().Where(shippingrule.ZoneIDIn(zoneIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	rules := &ShippingProfileRules{Id: profile.ID, Currency: profile.Currency, FreeThresholdMinor: profile.FreeShippingThresholdMinor}
	byZone := map[uuid.UUID][]ShippingDestinationRule{}
	for _, destination := range destinations {
		byZone[destination.ZoneID] = append(byZone[destination.ZoneID], ShippingDestinationRule{CountryCode: destination.CountryCode, RegionId: destination.RegionID, AdminAreaId: destination.AdminAreaID})
	}
	for _, zone := range zones {
		rules.Zones = append(rules.Zones, ShippingZoneRule{Id: zone.ID, Name: zone.Name, Active: zone.Active, Destinations: byZone[zone.ID]})
	}
	for _, rule := range feeRules {
		rules.Rules = append(rules.Rules, ShippingFeeRule{Id: rule.ID, ZoneId: rule.ZoneID, FeeMinor: rule.FeeMinor, IsFree: rule.IsFree, FreeThresholdMinor: rule.FreeThresholdMinor, Active: rule.Active})
	}
	return rules, nil
}
