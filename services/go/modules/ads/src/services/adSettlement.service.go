package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/events"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccount"
	"zudomart/modules/ads/src/generated/ent/adcreatorearning"
	"zudomart/modules/ads/src/generated/ent/adimpression"
	"zudomart/modules/ads/src/generated/ent/adpooldaily"
	"zudomart/modules/ads/src/types"
)

const settlementBatchLimit = 5_000

type AdSettlement struct {
	Client *ent.Client
	Now    func() time.Time
}

type accountSettlementTotals struct {
	ids                  []uuid.UUID
	currency             string
	spendMicros          int64
	creatorMicros        int64
	platformMicros       int64
	creatorMicrosByUser  map[string]int64
	creatorImpressionsBy map[string]int64
}

func (settlement AdSettlement) SettlePendingCharges(ctx context.Context) (int, error) {
	rows, err := settlement.Client.AdImpression.Query().
		Where(adimpression.ChargeMicrosGT(0), adimpression.SettlementBatchIDIsNil()).Order(ent.Asc(adimpression.FieldServedAt)).Limit(settlementBatchLimit).All(ctx)
	if err != nil || len(rows) == 0 {
		return 0, err
	}
	byAccount := map[uuid.UUID]*accountSettlementTotals{}
	for _, row := range rows {
		totals := byAccount[row.AccountID]
		if totals == nil {
			totals = &accountSettlementTotals{currency: row.Currency, creatorMicrosByUser: map[string]int64{}, creatorImpressionsBy: map[string]int64{}}
			byAccount[row.AccountID] = totals
		}
		totals.ids = append(totals.ids, row.ID)
		totals.spendMicros += row.ChargeMicros
		totals.creatorMicros += row.CreatorShareMicros
		totals.platformMicros += row.PlatformShareMicros
		if row.CreatorUserID != "" && row.CreatorShareMicros > 0 {
			totals.creatorMicrosByUser[row.CreatorUserID] += row.CreatorShareMicros
			totals.creatorImpressionsBy[row.CreatorUserID]++
		}
	}
	if err := settlement.excludePausedCreators(ctx, byAccount); err != nil {
		return 0, err
	}
	settled := 0
	var failures []error
	for accountId, totals := range byAccount {
		if err := settlement.settleAccount(ctx, accountId, totals); err != nil {
			failures = append(failures, fmt.Errorf("settle account %s: %w", accountId, err))
			continue
		}
		settled += len(totals.ids)
	}
	return settled, errors.Join(failures...)
}

func (settlement AdSettlement) settleAccount(ctx context.Context, accountId uuid.UUID, totals *accountSettlementTotals) error {
	tx, err := settlement.Client.Tx(ctx)
	if err != nil {
		return err
	}
	if err := settlement.settleAccountInTransaction(ctx, tx, accountId, totals); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (settlement AdSettlement) settleAccountInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, totals *accountSettlementTotals) error {
	now := settlement.Now()
	account, err := tx.AdAccount.Query().Where(adaccount.ID(accountId)).ForUpdate().Only(ctx)
	if err != nil {
		return err
	}
	debitMinor, carry := WholeMinorUnitsAndCarry(account.SpendCarryMicros + totals.spendMicros)
	creditUsed := min(debitMinor, usableCreditMinor(account, now))
	balanceUsed := min(debitMinor-creditUsed, account.BalanceMinor)
	shortfallMinor := debitMinor - creditUsed - balanceUsed
	if shortfallMinor > 0 {
		totals.scaleSharesToCollected(creditUsed+balanceUsed, debitMinor)
	}
	batch, err := tx.AdSpendBatch.Create().SetAccountID(accountId).SetCurrency(totals.currency).SetImpressionCount(len(totals.ids)).SetSpendMicros(totals.spendMicros).
		SetDebitedMinor(creditUsed + balanceUsed).SetCreatorShareMicros(totals.creatorMicros).SetPlatformShareMicros(totals.platformMicros).Save(ctx)
	if err != nil {
		return err
	}
	if err := tx.AdImpression.Update().Where(adimpression.IDIn(totals.ids...)).SetSettlementBatchID(batch.ID).Exec(ctx); err != nil {
		return err
	}
	if err := tx.AdAccount.UpdateOneID(accountId).AddBalanceMinor(-balanceUsed).AddCreditMinor(-creditUsed).AddAmountSpentMicros(totals.spendMicros).SetSpendCarryMicros(carry).Exec(ctx); err != nil {
		return err
	}
	if err := recordSpendTransactions(ctx, tx, accountId, totals.currency, batch.ID, creditUsed, balanceUsed); err != nil {
		return err
	}
	if shortfallMinor > 0 {
		if err := recordShortfallDebt(ctx, tx, accountId, totals.currency, batch.ID, shortfallMinor); err != nil {
			return err
		}
	}
	if err := settlement.accruePools(ctx, tx, totals, now); err != nil {
		return err
	}
	if err := events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdSpendBatched, batch.ID.String(), now, events.AdSpendBatchedEventData{
		BatchId: batch.ID.String(), AccountId: accountId.String(), Currency: totals.currency, DebitMinor: creditUsed + balanceUsed, SpendMicros: totals.spendMicros,
		CreatorShareMicros: totals.creatorMicros, PlatformShareMicros: totals.platformMicros, ImpressionCount: len(totals.ids), IdempotencyKey: "adSpend:" + batch.ID.String(),
	}); err != nil {
		return err
	}
	return settlement.postCreatorEarnings(ctx, tx, totals, batch.ID, now)
}

func usableCreditMinor(account *ent.AdAccount, now time.Time) int64 {
	if account.CreditExpiresAt != nil && !account.CreditExpiresAt.After(now) {
		return 0
	}
	return account.CreditMinor
}

func recordSpendTransactions(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, currency string, batchId uuid.UUID, creditUsed, balanceUsed int64) error {
	if balanceUsed > 0 {
		if err := tx.AdFundsTransaction.Create().SetAccountID(accountId).SetType("ad_spend").SetAmountMinor(-balanceUsed).SetCurrency(currency).SetDescription("Ad spend").SetReference("spend:" + batchId.String()).Exec(ctx); err != nil {
			return err
		}
	}
	if creditUsed > 0 {
		return tx.AdFundsTransaction.Create().SetAccountID(accountId).SetType("credit_spend").SetAmountMinor(-creditUsed).SetCurrency(currency).SetDescription("Ad spend paid with credits").SetReference("credit:" + batchId.String()).Exec(ctx)
	}
	return nil
}

func (settlement AdSettlement) accruePools(ctx context.Context, tx *ent.Tx, totals *accountSettlementTotals, now time.Time) error {
	return tx.AdPoolDaily.Create().SetDay(now.UTC().Format("2006-01-02")).SetCurrency(totals.currency).SetGrossMicros(totals.spendMicros).
		SetCreatorPoolMicros(totals.creatorMicros).SetPlatformPoolMicros(totals.platformMicros).SetQualifiedImpressions(int64(len(totals.ids))).
		OnConflictColumns(adpooldaily.FieldDay, adpooldaily.FieldCurrency).
		AddGrossMicros(totals.spendMicros).AddCreatorPoolMicros(totals.creatorMicros).AddPlatformPoolMicros(totals.platformMicros).AddQualifiedImpressions(int64(len(totals.ids))).Exec(ctx)
}

func (settlement AdSettlement) postCreatorEarnings(ctx context.Context, tx *ent.Tx, totals *accountSettlementTotals, batchId uuid.UUID, now time.Time) error {
	for creatorId, micros := range totals.creatorMicrosByUser {
		earning, err := tx.AdCreatorEarning.Query().Where(adcreatorearning.CreatorUserID(creatorId), adcreatorearning.Currency(totals.currency)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			earning, err = tx.AdCreatorEarning.Create().SetCreatorUserID(creatorId).SetCurrency(totals.currency).Save(ctx)
		}
		if err != nil {
			return err
		}
		accrued := earning.AccruedMicros + micros
		deltaMinor := accrued/types.MicrosPerMinorUnit - earning.PostedMinor
		if err := tx.AdCreatorEarning.UpdateOneID(earning.ID).SetAccruedMicros(accrued).AddPostedMinor(deltaMinor).AddQualifiedImpressions(totals.creatorImpressionsBy[creatorId]).Exec(ctx); err != nil {
			return err
		}
		if deltaMinor <= 0 {
			continue
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdCreatorEarningsPosted, creatorId, now, events.AdCreatorEarningsPostedEventData{
			CreatorUserId: creatorId, Currency: totals.currency, AmountMinor: deltaMinor, BatchId: batchId.String(), IdempotencyKey: "adCreator:" + batchId.String() + ":" + creatorId,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (settlement AdSettlement) excludePausedCreators(ctx context.Context, byAccount map[uuid.UUID]*accountSettlementTotals) error {
	creatorIds := []string{}
	for _, totals := range byAccount {
		for creatorId := range totals.creatorMicrosByUser {
			creatorIds = append(creatorIds, creatorId)
		}
	}
	paused, err := (CreatorMonetisationHolds{Client: settlement.Client, Now: settlement.Now}).PausedCreators(ctx, creatorIds)
	if err != nil || len(paused) == 0 {
		return err
	}
	for _, totals := range byAccount {
		totals.creatorMicros, totals.platformMicros = ExcludePausedCreatorsFromTotals(totals.creatorMicros, totals.platformMicros, totals.creatorMicrosByUser, totals.creatorImpressionsBy, paused)
	}
	return nil
}
