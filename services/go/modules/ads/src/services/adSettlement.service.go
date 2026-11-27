package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/ads/src/events"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adcreatorearning"
	"nantty/modules/ads/src/generated/ent/adimpression"
	"nantty/modules/ads/src/generated/ent/adpooldaily"
	"nantty/modules/ads/src/types"
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
	accountIds := make([]uuid.UUID, 0, len(rows))
	seenAccounts := make(map[uuid.UUID]struct{}, len(rows))
	for _, row := range rows {
		if _, ok := seenAccounts[row.AccountID]; !ok {
			seenAccounts[row.AccountID] = struct{}{}
			accountIds = append(accountIds, row.AccountID)
		}
	}
	settled := 0
	var failures []error
	for _, accountId := range accountIds {
		count, err := settlement.settlePendingAccount(ctx, accountId)
		if err != nil {
			failures = append(failures, fmt.Errorf("settle account %s: %w", accountId, err))
			continue
		}
		settled += count
	}
	return settled, errors.Join(failures...)
}

func (settlement AdSettlement) settlePendingAccount(ctx context.Context, accountId uuid.UUID) (int, error) {
	tx, err := settlement.Client.Tx(ctx)
	if err != nil {
		return 0, err
	}
	rows, err := tx.AdImpression.Query().Where(adimpression.AccountID(accountId), adimpression.ChargeMicrosGT(0), adimpression.SettlementBatchIDIsNil()).
		Order(ent.Asc(adimpression.FieldServedAt), ent.Asc(adimpression.FieldID)).Limit(settlementBatchLimit).
		ForUpdate(sql.WithLockAction(sql.SkipLocked)).All(ctx)
	if err != nil {
		_ = tx.Rollback()
		return 0, err
	}
	if len(rows) == 0 {
		_ = tx.Rollback()
		return 0, nil
	}
	totals := totalsForImpressions(rows)
	if err := settlement.excludePausedCreators(ctx, tx.Client(), map[uuid.UUID]*accountSettlementTotals{accountId: totals}); err != nil {
		_ = tx.Rollback()
		return 0, err
	}
	if err := settlement.settleAccountInTransaction(ctx, tx, accountId, totals); err != nil {
		_ = tx.Rollback()
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return len(totals.ids), nil
}

func totalsForImpressions(rows []*ent.AdImpression) *accountSettlementTotals {
	totals := &accountSettlementTotals{currency: rows[0].Currency, creatorMicrosByUser: map[string]int64{}, creatorImpressionsBy: map[string]int64{}}
	for _, row := range rows {
		totals.ids = append(totals.ids, row.ID)
		totals.spendMicros += row.ChargeMicros
		totals.creatorMicros += row.CreatorShareMicros
		totals.platformMicros += row.PlatformShareMicros
		if row.CreatorUserID != "" && row.CreatorShareMicros > 0 {
			totals.creatorMicrosByUser[row.CreatorUserID] += row.CreatorShareMicros
			totals.creatorImpressionsBy[row.CreatorUserID]++
		}
	}
	return totals
}

func (settlement AdSettlement) settleAccountInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, totals *accountSettlementTotals) error {
	now := settlement.Now()
	account, err := tx.AdAccount.Query().Where(adaccount.ID(accountId)).ForUpdate().Only(ctx)
	if err != nil {
		return err
	}
	debitMinor, carry := WholeMinorUnitsAndCarry(account.SpendCarryMicros + totals.spendMicros)
	creditUsed, err := ConsumeCreditInSpendOrder(ctx, tx, accountId, min(debitMinor, max(account.CreditMinor, 0)), now)
	if err != nil {
		return err
	}
	balanceUsed := min(debitMinor-creditUsed, account.BalanceMinor)
	cashbackMinor, err := CashbackForRealSpend(ctx, tx, account.OwnerUserID, balanceUsed)
	if err != nil {
		return err
	}
	shortfallMinor := debitMinor - creditUsed - balanceUsed
	if shortfallMinor > 0 {
		totals.scaleSharesToCollected(creditUsed+balanceUsed, debitMinor)
	}
	batch, err := tx.AdSpendBatch.Create().SetAccountID(accountId).SetCurrency(totals.currency).SetImpressionCount(len(totals.ids)).SetSpendMicros(totals.spendMicros).
		SetDebitedMinor(creditUsed + balanceUsed).SetCreditUsedMinor(creditUsed).SetCashbackMinor(cashbackMinor).SetCreatorShareMicros(totals.creatorMicros).SetPlatformShareMicros(totals.platformMicros).Save(ctx)
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
	if err := issueCashbackInTransaction(ctx, tx, account, batch.ID, cashbackMinor, now); err != nil {
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
		BatchId: batch.ID.String(), AccountId: accountId.String(), Currency: totals.currency, DebitMinor: balanceUsed, CreditDebitMinor: creditUsed, SpendMicros: totals.spendMicros,
		CreatorShareMicros: totals.creatorMicros, PlatformShareMicros: totals.platformMicros, ImpressionCount: len(totals.ids), IdempotencyKey: "adSpend:" + batch.ID.String(),
	}); err != nil {
		return err
	}
	return settlement.postCreatorEarnings(ctx, tx, totals, batch.ID, now)
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

func (settlement AdSettlement) excludePausedCreators(ctx context.Context, client *ent.Client, byAccount map[uuid.UUID]*accountSettlementTotals) error {
	creatorIds := []string{}
	for _, totals := range byAccount {
		for creatorId := range totals.creatorMicrosByUser {
			creatorIds = append(creatorIds, creatorId)
		}
	}
	paused, err := (CreatorMonetisationHolds{Client: client, Now: settlement.Now}).PausedCreators(ctx, creatorIds)
	if err != nil || len(paused) == 0 {
		return err
	}
	for _, totals := range byAccount {
		totals.creatorMicros, totals.platformMicros = ExcludePausedCreatorsFromTotals(totals.creatorMicros, totals.platformMicros, totals.creatorMicrosByUser, totals.creatorImpressionsBy, paused)
	}
	return nil
}
