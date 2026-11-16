package services

import (
	"context"
	"errors"
	"time"

	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent/planprice"
	"nantty/modules/subscriptions/src/generated/ent/planpriceversion"
)

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
		SetAndroidMonthlyAmountMinor(row.AndroidMonthlyMinor).SetAndroidYearlyAmountMinor(row.AndroidYearlyAmountMinor).SetStoreProductIds(row.StoreProductIds).
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
