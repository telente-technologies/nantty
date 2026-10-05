package integrations

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/platform/commerceports"
)

type StoreTaxRates struct {
	Container *container.Container
}

var _ commerceports.StoreTaxRatesReader = StoreTaxRates{}

func (reader StoreTaxRates) TaxSettingsForStore(ctx context.Context, storeId uuid.UUID) (commerceports.StoreTaxSettings, error) {
	row, err := reader.Container.Client.Store.Get(ctx, storeId)
	if err != nil {
		return commerceports.StoreTaxSettings{}, err
	}
	settings := commerceports.StoreTaxSettings{PricesIncludeTax: row.PricesIncludeTax, Rates: make([]commerceports.StoreTaxRate, 0, len(row.TaxRates))}
	for _, rate := range row.TaxRates {
		categories := make([]uuid.UUID, 0, len(rate.AppliesToCategoryIds))
		for _, raw := range rate.AppliesToCategoryIds {
			if categoryId, parseError := uuid.Parse(raw); parseError == nil {
				categories = append(categories, categoryId)
			}
		}
		settings.Rates = append(settings.Rates, commerceports.StoreTaxRate{Id: rate.Id, Name: rate.Name, RateBasisPoints: rate.RateBasisPoints, IsDefault: rate.IsDefault, CategoryIds: categories})
	}
	return settings, nil
}
