package recordconversion

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccount"
	"zudomart/modules/ads/src/generated/ent/adconversion"
	"zudomart/modules/ads/src/generated/ent/adimpression"
	"zudomart/modules/ads/src/generated/ent/adstatsdaily"
	adsservices "zudomart/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

type Result struct{ Attributed bool }

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	deployed := handler.Container
	if seen, err := deployed.Client.AdConversion.Query().Where(adconversion.ConversionID(command.ConversionId)).Exist(ctx); err != nil || seen {
		return Result{}, err
	}
	accountIds, err := deployed.Client.AdAccount.Query().Where(adaccount.StoreID(command.StoreId)).IDs(ctx)
	if err != nil || len(accountIds) == 0 {
		return Result{}, err
	}
	touch, err := deployed.Client.AdImpression.Query().Where(
		adimpression.UserID(command.UserId), adimpression.AccountIDIn(accountIds...), adimpression.ClickedAtNotNil(), adimpression.ClickedAtGTE(command.OccurredAt.Add(-attributionWindow)),
		adimpression.ClickedAtLTE(command.OccurredAt), adimpression.FraudStatusNEQ(adimpression.FraudStatusInvalid),
	).Order(ent.Desc(adimpression.FieldClickedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return Result{}, nil
	}
	if err != nil {
		return Result{}, err
	}
	account, err := deployed.Client.AdAccount.Get(ctx, touch.AccountID)
	if err != nil || account.Currency != command.Currency {
		return Result{}, err
	}
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.AdConversion.Create().SetConversionID(command.ConversionId).SetStoreID(command.StoreId).SetUserID(command.UserId).SetImpressionID(touch.ID).SetAdID(touch.AdID).
			SetAccountID(touch.AccountID).SetValueMinor(command.ValueMinor).SetCurrency(command.Currency).SetOccurredAt(command.OccurredAt).Exec(ctx); err != nil {
			return err
		}
		return tx.AdStatsDaily.Create().SetDay(adsservices.DayKeyInTimezone(command.OccurredAt, account.Timezone)).SetAccountID(touch.AccountID).SetCampaignID(touch.CampaignID).SetAdGroupID(touch.AdGroupID).SetAdID(touch.AdID).
			SetPlacement(touch.Placement).SetCountry(touch.Country).SetRegion(touch.Region).SetAgeBand(touch.AgeBand).SetGender(touch.Gender).SetConversions(1).SetConversionValueMinor(command.ValueMinor).
			OnConflictColumns(adstatsdaily.FieldDay, adstatsdaily.FieldAdID, adstatsdaily.FieldPlacement, adstatsdaily.FieldCountry, adstatsdaily.FieldRegion, adstatsdaily.FieldAgeBand, adstatsdaily.FieldGender).
			AddConversions(1).AddConversionValueMinor(command.ValueMinor).Exec(ctx)
	})
	if ent.IsConstraintError(err) {
		return Result{}, nil
	}
	return Result{Attributed: err == nil}, err
}
