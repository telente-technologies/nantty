package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/planprice"
	"zudomart/platform/regionpricing"
)

type PlanPriceRow struct {
	PlanCode            string            `json:"planCode"`
	CountryCode         string            `json:"countryCode"`
	Currency            string            `json:"currency"`
	MonthlyAmountMinor  int64             `json:"monthlyAmountMinor"`
	YearlyAmountMinor   int64             `json:"yearlyAmountMinor"`
	IosMonthlyMinor     int64             `json:"iosMonthlyAmountMinor"`
	IosYearlyMinor      int64             `json:"iosYearlyAmountMinor"`
	AndroidMonthlyMinor int64             `json:"androidMonthlyAmountMinor"`
	AndroidYearlyMinor  int64             `json:"androidYearlyAmountMinor"`
	StoreProductIds     map[string]string `json:"storeProductIds"`
	Active              bool              `json:"active"`
	UpdatedByStaffId    string            `json:"updatedByStaffId,omitempty"`
}

// SeedDefaultPricesWhenMissing writes the research price book for every region and fills the regional columns on rows
// that predate them, but never overwrites a row a staff member has edited.
func (billing Billing) SeedDefaultPricesWhenMissing(ctx context.Context) error {
	client := billing.Container.Client(billing.Container.Resources.Database)
	for _, price := range regionpricing.DefaultPlanPrices() {
		if _, known := constants.Plans[price.PlanCode]; !known {
			continue
		}
		err := client.PlanPrice.Create().SetPlanCode(price.PlanCode).SetCountryCode(price.Region).SetCurrency(price.Currency).
			SetMonthlyAmountMinor(price.WebMonthlyMinor).SetYearlyAmountMinor(price.WebYearlyMinor).
			SetIosMonthlyAmountMinor(price.IosMonthlyMinor).SetIosYearlyAmountMinor(price.IosYearlyMinor).
			SetAndroidMonthlyAmountMinor(price.AndroidMonthlyMinor).SetAndroidYearlyAmountMinor(price.AndroidYearlyMinor).
			SetStoreProductIds(price.StoreProductIds).SetCreatedAt(billing.Container.Now()).
			OnConflictColumns(planprice.FieldPlanCode, planprice.FieldCountryCode).DoNothing().Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		err = client.PlanPrice.Update().Where(planprice.PlanCode(price.PlanCode), planprice.CountryCode(price.Region), planprice.UpdatedByStaffID(""), planprice.YearlyAmountMinor(0)).
			SetYearlyAmountMinor(price.WebYearlyMinor).SetIosMonthlyAmountMinor(price.IosMonthlyMinor).SetIosYearlyAmountMinor(price.IosYearlyMinor).
			SetAndroidMonthlyAmountMinor(price.AndroidMonthlyMinor).SetAndroidYearlyAmountMinor(price.AndroidYearlyMinor).SetStoreProductIds(price.StoreProductIds).Exec(ctx)
		if err != nil {
			return err
		}
	}
	return nil
}

func convertPlanPrice(row *ent.PlanPrice) PlanPriceRow {
	return PlanPriceRow{
		PlanCode: row.PlanCode, CountryCode: row.CountryCode, Currency: row.Currency, MonthlyAmountMinor: row.MonthlyAmountMinor, YearlyAmountMinor: row.YearlyAmountMinor,
		IosMonthlyMinor: row.IosMonthlyAmountMinor, IosYearlyMinor: row.IosYearlyAmountMinor, AndroidMonthlyMinor: row.AndroidMonthlyAmountMinor, AndroidYearlyMinor: row.AndroidYearlyAmountMinor,
		StoreProductIds: row.StoreProductIds, Active: row.Active, UpdatedByStaffId: row.UpdatedByStaffID,
	}
}

func (row PlanPriceRow) regional() regionpricing.PlanRegionalPrice {
	return regionpricing.PlanRegionalPrice{
		PlanCode: row.PlanCode, Region: row.CountryCode, Currency: row.Currency, WebMonthlyMinor: row.MonthlyAmountMinor, WebYearlyMinor: row.YearlyAmountMinor,
		IosMonthlyMinor: row.IosMonthlyMinor, IosYearlyMinor: row.IosYearlyMinor, AndroidMonthlyMinor: row.AndroidMonthlyMinor, AndroidYearlyMinor: row.AndroidYearlyMinor,
		StoreProductIds: row.StoreProductIds,
	}
}

func (billing Billing) webCanCharge(currency string) bool {
	if billing.Container.Payments == nil || billing.Container.Payments.Container == nil {
		return true
	}
	provider, err := billing.Container.Payments.Container.DefaultProvider()
	return err == nil && provider.SupportsCurrency(currency)
}

func (billing Billing) findActivePrice(ctx context.Context, client *ent.Client, planCode, region string) (*ent.PlanPrice, error) {
	return client.PlanPrice.Query().Where(planprice.PlanCode(planCode), planprice.CountryCode(region), planprice.Active(true)).Only(ctx)
}

// RegionalPriceFor resolves a country (or pricing region) to its price row. Unknown countries, and regions without an
// active row, use the US price in USD. On the web a currency Paystack can't charge (GBP, EUR, or a currency not enabled
// on the account) also uses the US price, so the price shown is always the price charged.
func (billing Billing) RegionalPriceFor(ctx context.Context, client *ent.Client, planCode, countryOrRegion, channel string) (regionpricing.PlanRegionalPrice, error) {
	region, found := regionpricing.FindRegion(countryOrRegion)
	if !found {
		region, _ = regionpricing.RegionForCountry(countryOrRegion)
	}
	row, err := billing.findActivePrice(ctx, client, planCode, region.Code)
	if err == nil && channel == "web" && !billing.webCanCharge(row.Currency) {
		err = &ent.NotFoundError{}
	}
	if ent.IsNotFound(err) && region.Code != regionpricing.FallbackRegion.Code {
		row, err = billing.findActivePrice(ctx, client, planCode, regionpricing.FallbackRegion.Code)
	}
	if ent.IsNotFound(err) {
		return regionpricing.PlanRegionalPrice{}, ErrPlanNotFound
	}
	if err != nil {
		return regionpricing.PlanRegionalPrice{}, err
	}
	price := convertPlanPrice(row).regional()
	if row.Currency == "NGN" {
		_, pricing := billing.rules(ctx)
		switch {
		case planCode == constants.PlanGoldOnly && pricing.GoldOnlyMonthlyMinor > 0:
			price.WebMonthlyMinor, price.WebYearlyMinor = pricing.GoldOnlyMonthlyMinor, 0
		case planCode == constants.PlanBlack && pricing.BlackMonthlyMinor > 0:
			price.WebMonthlyMinor, price.WebYearlyMinor = pricing.BlackMonthlyMinor, 0
		}
	}
	return price, nil
}

func (billing Billing) PlanForStoreProduct(ctx context.Context, productId string) (string, string, bool) {
	rows, err := billing.Container.Client(billing.Container.Resources.Database).PlanPrice.Query().Where(planprice.Active(true)).All(ctx)
	if err == nil {
		for _, row := range rows {
			for key, candidate := range row.StoreProductIds {
				if _, interval, found := strings.Cut(key, "."); found && candidate == productId && (interval == "month" || interval == "year") {
					return row.PlanCode, interval, true
				}
			}
		}
	}
	product, known := billing.Container.Settings.StoreProductPlans[productId]
	return product.PlanCode, product.Interval, known
}

func (billing Billing) ListPriceTable(ctx context.Context) ([]PlanPriceRow, error) {
	rows, err := billing.Container.Client(billing.Container.Resources.Database).PlanPrice.Query().Order(ent.Asc(planprice.FieldPlanCode), ent.Asc(planprice.FieldCountryCode)).All(ctx)
	if err != nil {
		return nil, err
	}
	converted := make([]PlanPriceRow, 0, len(rows))
	for _, row := range rows {
		converted = append(converted, convertPlanPrice(row))
	}
	return converted, nil
}

func (billing Billing) FindPriceRow(ctx context.Context, planCode, region string) (PlanPriceRow, bool) {
	row, err := billing.Container.Client(billing.Container.Resources.Database).PlanPrice.Query().Where(planprice.PlanCode(planCode), planprice.CountryCode(region)).Only(ctx)
	if err != nil {
		return PlanPriceRow{}, false
	}
	return convertPlanPrice(row), true
}

func (billing Billing) UpsertPrice(ctx context.Context, staffId string, row PlanPriceRow) (PlanPriceRow, error) {
	if _, known := constants.Plans[row.PlanCode]; !known {
		return PlanPriceRow{}, ErrPlanNotFound
	}
	if row.StoreProductIds == nil {
		row.StoreProductIds = map[string]string{}
	}
	row.UpdatedByStaffId = staffId
	err := billing.Container.Client(billing.Container.Resources.Database).PlanPrice.Create().SetPlanCode(row.PlanCode).SetCountryCode(row.CountryCode).SetCurrency(row.Currency).
		SetMonthlyAmountMinor(row.MonthlyAmountMinor).SetYearlyAmountMinor(row.YearlyAmountMinor).
		SetIosMonthlyAmountMinor(row.IosMonthlyMinor).SetIosYearlyAmountMinor(row.IosYearlyMinor).
		SetAndroidMonthlyAmountMinor(row.AndroidMonthlyMinor).SetAndroidYearlyAmountMinor(row.AndroidYearlyMinor).SetStoreProductIds(row.StoreProductIds).
		SetActive(row.Active).SetUpdatedByStaffID(staffId).SetCreatedAt(billing.Container.Now()).
		OnConflictColumns(planprice.FieldPlanCode, planprice.FieldCountryCode).
		Update(func(upsert *ent.PlanPriceUpsert) {
			upsert.UpdateCurrency().UpdateMonthlyAmountMinor().UpdateYearlyAmountMinor().UpdateIosMonthlyAmountMinor().UpdateIosYearlyAmountMinor().
				UpdateAndroidMonthlyAmountMinor().UpdateAndroidYearlyAmountMinor().UpdateStoreProductIds().UpdateActive().UpdateUpdatedByStaffID().UpdateUpdatedAt()
		}).Exec(ctx)
	return row, err
}
