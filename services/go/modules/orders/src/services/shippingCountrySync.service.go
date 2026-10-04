package services

import (
	"context"
	"log/slog"
	"slices"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent/shippingdestination"
	"zudomart/modules/orders/src/generated/ent/shippingprofile"
	"zudomart/modules/orders/src/generated/ent/shippingrule"
	"zudomart/modules/orders/src/generated/ent/shippingzone"
	"zudomart/platform/commerceports"
)

func DeliverableCountries(ctx context.Context, deployed *container.Container, storeId uuid.UUID) ([]string, error) {
	profileIds, err := deployed.Client.ShippingProfile.Query().Where(shippingprofile.StoreID(storeId), shippingprofile.Active(true)).IDs(ctx)
	if err != nil || len(profileIds) == 0 {
		return []string{}, err
	}
	zoneIds, err := deployed.Client.ShippingZone.Query().Where(shippingzone.ProfileIDIn(profileIds...), shippingzone.Active(true)).IDs(ctx)
	if err != nil || len(zoneIds) == 0 {
		return []string{}, err
	}
	rules, err := deployed.Client.ShippingRule.Query().Where(shippingrule.ZoneIDIn(zoneIds...), shippingrule.Active(true)).All(ctx)
	if err != nil || len(rules) == 0 {
		return []string{}, err
	}
	activeZones := make([]uuid.UUID, 0, len(rules))
	for _, rule := range rules {
		activeZones = append(activeZones, rule.ZoneID)
	}
	countries, err := deployed.Client.ShippingDestination.Query().Where(shippingdestination.ZoneIDIn(activeZones...)).Select(shippingdestination.FieldCountryCode).Strings(ctx)
	if err != nil {
		return nil, err
	}
	slices.Sort(countries)
	return slices.Compact(countries), nil
}

// SyncStoreShippingCountries tells the catalog where a store delivers so product visibility can follow the shipping rules.
func SyncStoreShippingCountries(ctx context.Context, deployed *container.Container, storeId uuid.UUID) {
	sink, err := commerceports.Default.StoreShippingCountries()
	if err != nil {
		return
	}
	countries, err := DeliverableCountries(ctx, deployed, storeId)
	if err == nil {
		err = sink.SetStoreShippingCountries(ctx, storeId, countries)
	}
	if err != nil {
		deployed.Logger.WarnContext(ctx, "could not sync store shipping countries", slog.String("storeId", storeId.String()), slog.Any("error", err))
	}
}
