package services

import (
	"context"
	"math/big"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccount"
)

const shortfallDisabledReason = "Unpaid ad spend: top up to clear the amount owed"

func recordShortfallDebt(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, currency string, batchId uuid.UUID, shortfallMinor int64) error {
	if err := tx.AdAccount.UpdateOneID(accountId).SetStatus(adaccount.StatusDisabled).SetDisabledReason(shortfallDisabledReason).Exec(ctx); err != nil {
		return err
	}
	return tx.AdFundsTransaction.Create().SetAccountID(accountId).SetType("ad_spend_debt").SetAmountMinor(shortfallMinor).SetCurrency(currency).
		SetDescription("Ad spend the balance could not cover").SetReference("shortfall:"+batchId.String()).
		OnConflictColumns("account_id", "reference").DoNothing().Exec(ctx)
}

func (totals *accountSettlementTotals) scaleSharesToCollected(collectedMinor, debitMinor int64) {
	if debitMinor <= 0 {
		return
	}
	scale := func(micros int64) int64 {
		if micros <= 0 || collectedMinor <= 0 {
			return 0
		}
		product := new(big.Int).Mul(big.NewInt(micros), big.NewInt(collectedMinor))
		return product.Quo(product, big.NewInt(debitMinor)).Int64()
	}
	totals.creatorMicros = 0
	for creatorId, micros := range totals.creatorMicrosByUser {
		scaled := scale(micros)
		totals.creatorMicrosByUser[creatorId] = scaled
		totals.creatorMicros += scaled
	}
	totals.platformMicros = scale(totals.platformMicros)
}
