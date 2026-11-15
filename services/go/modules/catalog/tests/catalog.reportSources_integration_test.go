package catalog_test

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/databases/schema"
	"nantty/platform/commerceports"
)

func TestStoreTaxRatesReaderExposesStoreSettings(t *testing.T) {
	harness := startHttpHarness(t)
	shop := harness.store(uuid.New(), "Tax Shop")
	categoryId := uuid.New()
	rates := []schema.StoreTaxRate{{Id: "vat", Name: "VAT", RateBasisPoints: 750, IsDefault: true, AppliesToCategoryIds: []string{categoryId.String(), "not-an-id"}}}
	if err := harness.client().Store.UpdateOne(shop).SetTaxRates(rates).SetPricesIncludeTax(true).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	reader, err := commerceports.Default.StoreTaxRatesReader()
	if err != nil {
		t.Fatal(err)
	}
	settings, err := reader.TaxSettingsForStore(context.Background(), shop.ID)
	if err != nil || !settings.PricesIncludeTax || len(settings.Rates) != 1 {
		t.Fatalf("settings: %+v %v", settings, err)
	}
	rate := settings.Rates[0]
	if rate.Name != "VAT" || rate.RateBasisPoints != 750 || !rate.IsDefault || len(rate.CategoryIds) != 1 || rate.CategoryIds[0] != categoryId {
		t.Fatalf("rate: %+v", rate)
	}
}
