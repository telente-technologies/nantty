package services

import (
	"context"

	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/planprice"
	"nantty/modules/subscriptions/src/generated/ent/planpriceversion"
)

func (billing Billing) ListPriceTable(ctx context.Context) ([]PlanPriceRow, error) {
	client := billing.Container.Client(billing.Container.Resources.Database)
	rows, err := client.PlanPrice.Query().Order(ent.Asc(planprice.FieldPlanCode), ent.Asc(planprice.FieldCountryCode)).All(ctx)
	if err != nil {
		return nil, err
	}
	versions, err := client.PlanPriceVersion.Query().Order(ent.Desc(planpriceversion.FieldEffectiveFrom)).Limit(5000).All(ctx)
	if err != nil {
		return nil, err
	}
	now := billing.Container.Now().UTC()
	byKey := make(map[string][]*ent.PlanPriceVersion, len(versions))
	for _, version := range versions {
		key := version.PlanCode + ":" + version.CountryCode
		byKey[key] = append(byKey[key], version)
	}
	converted := make([]PlanPriceRow, 0, len(rows))
	for _, row := range rows {
		priced := ApplyPlanPriceVersions(convertPlanPrice(row), byKey[row.PlanCode+":"+row.CountryCode], now)
		priced = billing.deriveStorePrices(ctx, priced)
		for index, history := range priced.History {
			historyPrice := PlanPriceRow{PlanCode: priced.PlanCode, CountryCode: priced.CountryCode, Currency: history.Currency,
				MonthlyAmountMinor: history.MonthlyAmountMinor, YearlyAmountMinor: history.YearlyAmountMinor,
				IosMonthlyMinor: history.IosMonthlyMinor, IosYearlyMinor: history.IosYearlyMinor,
				AndroidMonthlyMinor: history.AndroidMonthlyMinor, AndroidYearlyMinor: history.AndroidYearlyMinor,
				StoreProductIds: history.StoreProductIds, Active: history.Active}
			historyPrice = billing.deriveStorePrices(ctx, historyPrice)
			priced.History[index].IosMonthlyMinor, priced.History[index].IosYearlyMinor = historyPrice.IosMonthlyMinor, historyPrice.IosYearlyMinor
			priced.History[index].AndroidMonthlyMinor, priced.History[index].AndroidYearlyMinor = historyPrice.AndroidMonthlyMinor, historyPrice.AndroidYearlyMinor
		}
		converted = append(converted, priced)
	}
	return converted, nil
}

func (billing Billing) FindPriceRow(ctx context.Context, planCode, region string) (PlanPriceRow, bool) {
	rows, err := billing.ListPriceTable(ctx)
	if err != nil {
		return PlanPriceRow{}, false
	}
	for _, row := range rows {
		if row.PlanCode == planCode && row.CountryCode == region {
			return row, true
		}
	}
	return PlanPriceRow{}, false
}
