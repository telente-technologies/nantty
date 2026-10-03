package previewshipping

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/types"
	"zudomart/platform/money"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.ShippingCalculationView, error) {
	profile, err := services.EnsureDefaultShippingProfile(ctx, handler.Container, query.Store)
	if err != nil {
		return types.ShippingCalculationView{}, err
	}
	rules, err := services.LoadShippingProfileRules(ctx, handler.Container, []uuid.UUID{query.Store.StoreId})
	if err != nil {
		return types.ShippingCalculationView{}, err
	}
	location := services.DeliveryLocation{CountryCode: query.Store.CountryCode}
	region, found, err := handler.Container.Users.FindRegionByCode(ctx, query.Store.CountryCode, query.StateCode)
	if err != nil {
		return types.ShippingCalculationView{}, err
	}
	if !found {
		return types.ShippingCalculationView{}, ordererrors.DestinationInvalid
	}
	location.RegionId = &region.Id
	if query.LgaName != "" {
		if areaId, exists, lookupError := handler.Container.Users.FindAdminAreaIdByName(ctx, region.Id, query.LgaName); lookupError != nil || !exists {
			return types.ShippingCalculationView{}, firstFailure(lookupError, ordererrors.DestinationInvalid)
		} else {
			location.AdminAreaId = &areaId
		}
	}
	result := services.CalculateShippingForOrderGroup(rules[query.Store.StoreId], location, query.OrderTotalMinor)
	currency := money.CurrencyCode(profile.Currency)
	view := types.ShippingCalculationView{Outcome: result.Outcome, Fee: money.Money{AmountMinor: result.FeeMinor, Currency: currency}, ZoneName: result.ZoneName, MatchedLevel: result.MatchedLevel}
	if result.RuleId != nil {
		identifier := result.RuleId.String()
		view.RuleId = &identifier
	}
	if result.ThresholdAppliedMinor != nil {
		view.ThresholdApplied = &money.Money{AmountMinor: *result.ThresholdAppliedMinor, Currency: currency}
	}
	return view, nil
}

func firstFailure(primary, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}
