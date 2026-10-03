package services

import (
	"context"
	"database/sql"
	"errors"

	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/planprice"
)

type PlanPriceRow struct {
	PlanCode           string `json:"planCode"`
	CountryCode        string `json:"countryCode"`
	Currency           string `json:"currency"`
	MonthlyAmountMinor int64  `json:"monthlyAmountMinor"`
	Active             bool   `json:"active"`
}

func (billing Billing) SeedDefaultPricesWhenMissing(ctx context.Context) error {
	client := billing.Container.Client(billing.Container.Resources.Database)
	for code, definition := range constants.Plans {
		err := client.PlanPrice.Create().SetPlanCode(code).SetCountryCode("NG").SetCurrency("NGN").SetMonthlyAmountMinor(definition.DefaultMonthlyNgn).
			SetCreatedAt(billing.Container.Now()).OnConflictColumns(planprice.FieldPlanCode, planprice.FieldCountryCode).DoNothing().Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	return nil
}

func (billing Billing) MonthlyPriceFor(ctx context.Context, client *ent.Client, planCode, countryCode string) (int64, string, error) {
	row, err := client.PlanPrice.Query().Where(planprice.PlanCode(planCode), planprice.CountryCode(countryCode), planprice.Active(true)).Only(ctx)
	if ent.IsNotFound(err) && countryCode != billing.Container.Settings.DefaultCountry {
		row, err = client.PlanPrice.Query().Where(planprice.PlanCode(planCode), planprice.CountryCode(billing.Container.Settings.DefaultCountry), planprice.Active(true)).Only(ctx)
	}
	if ent.IsNotFound(err) {
		return 0, "", ErrPlanNotFound
	}
	if err != nil {
		return 0, "", err
	}
	if row.Currency == "NGN" {
		_, pricing := billing.rules(ctx)
		switch {
		case planCode == constants.PlanGoldOnly && pricing.GoldOnlyMonthlyMinor > 0:
			return pricing.GoldOnlyMonthlyMinor, row.Currency, nil
		case planCode == constants.PlanBlack && pricing.BlackMonthlyMinor > 0:
			return pricing.BlackMonthlyMinor, row.Currency, nil
		}
	}
	return row.MonthlyAmountMinor, row.Currency, nil
}

func (billing Billing) ListPriceTable(ctx context.Context) ([]PlanPriceRow, error) {
	rows, err := billing.Container.Client(billing.Container.Resources.Database).PlanPrice.Query().Order(ent.Asc(planprice.FieldPlanCode), ent.Asc(planprice.FieldCountryCode)).All(ctx)
	if err != nil {
		return nil, err
	}
	converted := make([]PlanPriceRow, 0, len(rows))
	for _, row := range rows {
		converted = append(converted, PlanPriceRow{PlanCode: row.PlanCode, CountryCode: row.CountryCode, Currency: row.Currency, MonthlyAmountMinor: row.MonthlyAmountMinor, Active: row.Active})
	}
	return converted, nil
}

func (billing Billing) UpsertPrice(ctx context.Context, staffId string, row PlanPriceRow) (PlanPriceRow, error) {
	if _, known := constants.Plans[row.PlanCode]; !known {
		return PlanPriceRow{}, ErrPlanNotFound
	}
	err := billing.Container.Client(billing.Container.Resources.Database).PlanPrice.Create().SetPlanCode(row.PlanCode).SetCountryCode(row.CountryCode).SetCurrency(row.Currency).
		SetMonthlyAmountMinor(row.MonthlyAmountMinor).SetActive(row.Active).SetUpdatedByStaffID(staffId).SetCreatedAt(billing.Container.Now()).
		OnConflictColumns(planprice.FieldPlanCode, planprice.FieldCountryCode).
		Update(func(upsert *ent.PlanPriceUpsert) {
			upsert.UpdateCurrency().UpdateMonthlyAmountMinor().UpdateActive().UpdateUpdatedByStaffID().UpdateUpdatedAt()
		}).Exec(ctx)
	return row, err
}
