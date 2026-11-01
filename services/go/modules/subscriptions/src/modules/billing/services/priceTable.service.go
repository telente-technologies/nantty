package services

import (
	"context"
	"database/sql"
	"errors"
	"sort"
	"strings"
	"time"

	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/planprice"
	"nantty/modules/subscriptions/src/generated/ent/planpriceversion"
	"nantty/platform/regionpricing"
)

type PlanPriceRow struct {
	PlanCode            string                    `json:"planCode"`
	CountryCode         string                    `json:"countryCode"`
	Currency            string                    `json:"currency"`
	MonthlyAmountMinor  int64                     `json:"monthlyAmountMinor"`
	YearlyAmountMinor   int64                     `json:"yearlyAmountMinor"`
	IosMonthlyMinor     int64                     `json:"iosMonthlyAmountMinor"`
	IosYearlyMinor      int64                     `json:"iosYearlyAmountMinor"`
	AndroidMonthlyMinor int64                     `json:"androidMonthlyAmountMinor"`
	AndroidYearlyMinor  int64                     `json:"androidYearlyAmountMinor"`
	StoreProductIds     map[string]string         `json:"storeProductIds"`
	Active              bool                      `json:"active"`
	UpdatedByStaffId    string                    `json:"updatedByStaffId,omitempty"`
	EffectiveFrom       time.Time                 `json:"effectiveFrom"`
	NextEffectiveFrom   *time.Time                `json:"nextEffectiveFrom,omitempty"`
	History             []PlanPriceVersionSummary `json:"history,omitempty"`
}

type PlanPriceVersionSummary struct {
	Currency            string            `json:"currency"`
	MonthlyAmountMinor  int64             `json:"monthlyAmountMinor"`
	YearlyAmountMinor   int64             `json:"yearlyAmountMinor"`
	IosMonthlyMinor     int64             `json:"iosMonthlyAmountMinor"`
	IosYearlyMinor      int64             `json:"iosYearlyAmountMinor"`
	AndroidMonthlyMinor int64             `json:"androidMonthlyAmountMinor"`
	AndroidYearlyMinor  int64             `json:"androidYearlyAmountMinor"`
	StoreProductIds     map[string]string `json:"storeProductIds"`
	Active              bool              `json:"active"`
	EffectiveFrom       time.Time         `json:"effectiveFrom"`
	CreatedByStaffId    string            `json:"createdByStaffId"`
	ChangeReason        string            `json:"changeReason"`
}

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
		err = client.PlanPrice.Update().Where(planprice.PlanCode(price.PlanCode), planprice.CountryCode(price.Region), planprice.UpdatedByStaffID(""),
			planprice.MonthlyAmountMinor(price.WebMonthlyMinor), planprice.YearlyAmountMinor(0)).
			SetYearlyAmountMinor(price.WebYearlyMinor).SetIosMonthlyAmountMinor(price.IosMonthlyMinor).SetIosYearlyAmountMinor(price.IosYearlyMinor).
			SetAndroidMonthlyAmountMinor(price.AndroidMonthlyMinor).SetAndroidYearlyAmountMinor(price.AndroidYearlyMinor).SetStoreProductIds(price.StoreProductIds).Exec(ctx)
		if err != nil {
			return err
		}
	}
	return nil
}

func convertPlanPrice(row *ent.PlanPrice) PlanPriceRow {
	effectiveFrom := row.UpdatedAt
	if effectiveFrom.IsZero() {
		effectiveFrom = row.CreatedAt
	}
	return PlanPriceRow{
		PlanCode: row.PlanCode, CountryCode: row.CountryCode, Currency: row.Currency, MonthlyAmountMinor: row.MonthlyAmountMinor, YearlyAmountMinor: row.YearlyAmountMinor,
		IosMonthlyMinor: row.IosMonthlyAmountMinor, IosYearlyMinor: row.IosYearlyAmountMinor, AndroidMonthlyMinor: row.AndroidMonthlyAmountMinor, AndroidYearlyMinor: row.AndroidYearlyAmountMinor,
		StoreProductIds: row.StoreProductIds, Active: row.Active, UpdatedByStaffId: row.UpdatedByStaffID, EffectiveFrom: effectiveFrom,
	}
}

func convertPlanPriceVersion(row *ent.PlanPriceVersion) PlanPriceRow {
	return PlanPriceRow{
		PlanCode: row.PlanCode, CountryCode: row.CountryCode, Currency: row.Currency, MonthlyAmountMinor: row.MonthlyAmountMinor, YearlyAmountMinor: row.YearlyAmountMinor,
		IosMonthlyMinor: row.IosMonthlyAmountMinor, IosYearlyMinor: row.IosYearlyAmountMinor, AndroidMonthlyMinor: row.AndroidMonthlyAmountMinor, AndroidYearlyMinor: row.AndroidYearlyAmountMinor,
		StoreProductIds: row.StoreProductIds, Active: row.Active, UpdatedByStaffId: row.CreatedByStaffID, EffectiveFrom: row.EffectiveFrom,
	}
}

func applyPriceVersions(base PlanPriceRow, versions []*ent.PlanPriceVersion, now time.Time) PlanPriceRow {
	versions = append([]*ent.PlanPriceVersion(nil), versions...)
	sort.SliceStable(versions, func(left, right int) bool { return versions[left].EffectiveFrom.Before(versions[right].EffectiveFrom) })
	current := base
	history := make([]PlanPriceVersionSummary, 0, len(versions))
	for _, version := range versions {
		history = append(history, PlanPriceVersionSummary{
			Currency: version.Currency, MonthlyAmountMinor: version.MonthlyAmountMinor, YearlyAmountMinor: version.YearlyAmountMinor,
			IosMonthlyMinor: version.IosMonthlyAmountMinor, IosYearlyMinor: version.IosYearlyAmountMinor,
			AndroidMonthlyMinor: version.AndroidMonthlyAmountMinor, AndroidYearlyMinor: version.AndroidYearlyAmountMinor,
			StoreProductIds: version.StoreProductIds, Active: version.Active, EffectiveFrom: version.EffectiveFrom,
			CreatedByStaffId: version.CreatedByStaffID, ChangeReason: version.ChangeReason,
		})
		if !version.EffectiveFrom.After(now) {
			nextEffectiveFrom := current.NextEffectiveFrom
			current = convertPlanPriceVersion(version)
			current.NextEffectiveFrom = nextEffectiveFrom
			continue
		}
		if current.NextEffectiveFrom == nil {
			next := version.EffectiveFrom
			current.NextEffectiveFrom = &next
		}
	}
	if len(history) > 20 {
		history = history[len(history)-20:]
	}
	current.History = history
	return current
}

func (row PlanPriceRow) regional() regionpricing.PlanRegionalPrice {
	return regionpricing.PlanRegionalPrice{
		PlanCode: row.PlanCode, Region: row.CountryCode, Currency: row.Currency, WebMonthlyMinor: row.MonthlyAmountMinor, WebYearlyMinor: row.YearlyAmountMinor,
		IosMonthlyMinor: row.IosMonthlyMinor, IosYearlyMinor: row.IosYearlyMinor, AndroidMonthlyMinor: row.AndroidMonthlyMinor, AndroidYearlyMinor: row.AndroidYearlyMinor,
		StoreProductIds: row.StoreProductIds,
	}
}

func (billing Billing) deriveStorePrices(ctx context.Context, row PlanPriceRow) PlanPriceRow {
	raw, found := billing.Container.Resources.Platform.ReadValue(ctx, regionpricing.StoreFeesSettingKey)
	fees := regionpricing.ParseStoreFeeSettings(raw, found)
	_, pricing := billing.rules(ctx)
	derived := regionpricing.DeriveStorePrices(row.regional(), fees, pricing.Pricing.YearlyDiscountBps)
	row.IosMonthlyMinor, row.IosYearlyMinor = derived.IosMonthlyMinor, derived.IosYearlyMinor
	row.AndroidMonthlyMinor, row.AndroidYearlyMinor = derived.AndroidMonthlyMinor, derived.AndroidYearlyMinor
	return row
}

func (billing Billing) webCanCharge(currency string) bool {
	if billing.Container.Payments == nil || billing.Container.Payments.Container == nil {
		return true
	}
	provider, err := billing.Container.Payments.Container.DefaultProvider()
	return err == nil && provider.SupportsCurrency(currency)
}

func (billing Billing) effectivePrice(ctx context.Context, client *ent.Client, planCode, region string) (PlanPriceRow, error) {
	version, err := client.PlanPriceVersion.Query().Where(
		planpriceversion.PlanCode(planCode), planpriceversion.CountryCode(region), planpriceversion.EffectiveFromLTE(billing.Container.Now().UTC()),
	).Order(ent.Desc(planpriceversion.FieldEffectiveFrom)).First(ctx)
	if err == nil {
		row := convertPlanPriceVersion(version)
		if !row.Active {
			return PlanPriceRow{}, &ent.NotFoundError{}
		}
		return row, nil
	}
	if !ent.IsNotFound(err) {
		return PlanPriceRow{}, err
	}
	legacy, legacyErr := client.PlanPrice.Query().Where(planprice.PlanCode(planCode), planprice.CountryCode(region), planprice.Active(true)).Only(ctx)
	if legacyErr != nil {
		return PlanPriceRow{}, legacyErr
	}
	return convertPlanPrice(legacy), nil
}

func (billing Billing) RegionalPriceFor(ctx context.Context, client *ent.Client, planCode, countryOrRegion, channel string) (regionpricing.PlanRegionalPrice, error) {
	region, found := regionpricing.FindRegion(countryOrRegion)
	if !found {
		region, _ = regionpricing.RegionForCountry(countryOrRegion)
	}
	row, err := billing.effectivePrice(ctx, client, planCode, region.Code)
	usdFallback, notChargeable := false, false
	if err == nil && channel == "web" {
		decision := regionpricing.DecideWebBilling(row.Currency, billing.webCanCharge)
		usdFallback, notChargeable = decision.UsdFallback, decision.NotAvailable
		if usdFallback {
			err = &ent.NotFoundError{}
		}
	}
	if ent.IsNotFound(err) && region.Code != regionpricing.FallbackRegion.Code {
		row, err = billing.effectivePrice(ctx, client, planCode, regionpricing.FallbackRegion.Code)
		if err == nil && channel == "web" && !billing.webCanCharge(row.Currency) {
			notChargeable = true
		}
	}
	if ent.IsNotFound(err) {
		return regionpricing.PlanRegionalPrice{}, ErrPlanNotFound
	}
	if err != nil {
		return regionpricing.PlanRegionalPrice{}, err
	}
	price := row.regional()
	if channel != "web" {
		_, pricing := billing.rules(ctx)
		price = regionpricing.DeriveStorePrices(price, billing.storeFeeSettings(ctx), pricing.Pricing.YearlyDiscountBps)
	}
	price.BilledInUsdFallback, price.NotChargeableOnWeb = usdFallback, notChargeable
	return price, nil
}

func (billing Billing) storeFeeSettings(ctx context.Context) regionpricing.StoreFeeSettings {
	raw, found := billing.Container.Resources.Platform.ReadValue(ctx, regionpricing.StoreFeesSettingKey)
	return regionpricing.ParseStoreFeeSettings(raw, found)
}

func (billing Billing) PlanForStoreProduct(ctx context.Context, productId string) (string, string, bool) {
	rows, err := billing.ListPriceTable(ctx)
	if err == nil {
		for _, row := range rows {
			if !row.Active {
				continue
			}
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

func (billing Billing) UpsertPrice(ctx context.Context, staffId, reason string, effectiveFrom time.Time, row PlanPriceRow) (PlanPriceRow, error) {
	if _, known := constants.Plans[row.PlanCode]; !known {
		return PlanPriceRow{}, ErrPlanNotFound
	}
	if row.StoreProductIds == nil {
		row.StoreProductIds = map[string]string{}
	}
	row = billing.deriveStorePrices(ctx, row)
	if effectiveFrom.Before(billing.Container.Now().UTC()) {
		return PlanPriceRow{}, errors.New("price effective date cannot be in the past")
	}
	row.UpdatedByStaffId = staffId
	client := billing.Container.Client(billing.Container.Resources.Database)
	tx, err := client.Tx(ctx)
	if err != nil {
		return PlanPriceRow{}, err
	}
	defer tx.Rollback()
	legacy, err := tx.PlanPrice.Query().Where(planprice.PlanCode(row.PlanCode), planprice.CountryCode(row.CountryCode)).Only(ctx)
	if err != nil {
		return PlanPriceRow{}, err
	}
	hasVersions, err := tx.PlanPriceVersion.Query().Where(planpriceversion.PlanCode(row.PlanCode), planpriceversion.CountryCode(row.CountryCode)).Exist(ctx)
	if err != nil {
		return PlanPriceRow{}, err
	}
	if !hasVersions {
		baselineAt := legacy.UpdatedAt.UTC()
		if baselineAt.IsZero() || !baselineAt.Before(effectiveFrom) {
			baselineAt = legacy.CreatedAt.UTC()
		}
		baselineStaff := legacy.UpdatedByStaffID
		if baselineStaff == "" {
			baselineStaff = "legacy"
		}
		if _, err := tx.PlanPriceVersion.Create().SetPlanCode(legacy.PlanCode).SetCountryCode(legacy.CountryCode).SetCurrency(legacy.Currency).
			SetMonthlyAmountMinor(legacy.MonthlyAmountMinor).SetYearlyAmountMinor(legacy.YearlyAmountMinor).
			SetIosMonthlyAmountMinor(legacy.IosMonthlyAmountMinor).SetIosYearlyAmountMinor(legacy.IosYearlyAmountMinor).
			SetAndroidMonthlyAmountMinor(legacy.AndroidMonthlyAmountMinor).SetAndroidYearlyAmountMinor(legacy.AndroidYearlyAmountMinor).
			SetStoreProductIds(legacy.StoreProductIds).SetActive(legacy.Active).SetEffectiveFrom(baselineAt).
			SetCreatedByStaffID(baselineStaff).SetChangeReason("Legacy price preserved as baseline before effective-dated pricing").Save(ctx); err != nil {
			return PlanPriceRow{}, err
		}
	}
	version, err := tx.PlanPriceVersion.Create().SetPlanCode(row.PlanCode).SetCountryCode(row.CountryCode).SetCurrency(row.Currency).
		SetMonthlyAmountMinor(row.MonthlyAmountMinor).SetYearlyAmountMinor(row.YearlyAmountMinor).
		SetIosMonthlyAmountMinor(row.IosMonthlyMinor).SetIosYearlyAmountMinor(row.IosYearlyMinor).
		SetAndroidMonthlyAmountMinor(row.AndroidMonthlyMinor).SetAndroidYearlyAmountMinor(row.AndroidYearlyMinor).SetStoreProductIds(row.StoreProductIds).
		SetActive(row.Active).SetEffectiveFrom(effectiveFrom.UTC()).SetCreatedByStaffID(staffId).SetChangeReason(reason).Save(ctx)
	if err != nil {
		return PlanPriceRow{}, err
	}
	if err := tx.Commit(); err != nil {
		return PlanPriceRow{}, err
	}
	rows, err := billing.ListPriceTable(ctx)
	if err != nil {
		return PlanPriceRow{}, err
	}
	for _, saved := range rows {
		if saved.PlanCode == row.PlanCode && saved.CountryCode == row.CountryCode {
			return saved, nil
		}
	}
	return convertPlanPriceVersion(version), nil
}
