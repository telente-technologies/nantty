package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcashbacksetting"
	"nantty/modules/ads/src/generated/ent/adcreditlot"
)

const DefaultCashbackPercent = 10

func CashbackForRealSpend(ctx context.Context, tx *ent.Tx, ownerUserId uuid.UUID, realSpendMinor int64) (int64, error) {
	if realSpendMinor <= 0 {
		return 0, nil
	}
	setting, err := tx.AdCashbackSetting.Query().Where(adcashbacksetting.UserID(ownerUserId), adcashbacksetting.Enabled(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return realSpendMinor * int64(setting.Percent) / 100, nil
}

func issueCashbackInTransaction(ctx context.Context, tx *ent.Tx, account *ent.AdAccount, batchId uuid.UUID, cashbackMinor int64, now time.Time) error {
	if cashbackMinor <= 0 {
		return nil
	}
	_, _, err := IssueCreditLotInTransaction(ctx, tx, CreditLotInput{
		AccountId: account.ID, UserId: account.OwnerUserID, Currency: account.Currency, Source: adcreditlot.SourceCashback, AmountMinor: cashbackMinor,
		Reason: "Cashback on ad spend", Reference: "cashback:" + batchId.String(), SpendBatchId: &batchId,
	}, now)
	return err
}
