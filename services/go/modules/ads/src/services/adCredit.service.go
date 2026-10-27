package services

import (
	"context"
	"time"

	entsql "entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/ads/src/events"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcreditlot"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
)

const (
	CreditChangeIssued           = "issued"
	CreditChangeCashback         = "cashback"
	CreditChangeExpired          = "expired"
	CreditChangeRevoked          = "revoked"
	CreditChangeCashbackReversed = "cashback_reversed"
)

type CreditLotInput struct {
	AccountId    uuid.UUID
	UserId       uuid.UUID
	Currency     string
	Source       adcreditlot.Source
	AmountMinor  int64
	ExpiresAt    *time.Time
	Reason       string
	Reference    string
	StaffId      string
	StaffName    string
	BoostId      *uuid.UUID
	SpendBatchId *uuid.UUID
	Description  string
}

func IssueCreditLotInTransaction(ctx context.Context, tx *ent.Tx, input CreditLotInput, now time.Time) (*ent.AdCreditLot, bool, error) {
	if existing, err := tx.AdCreditLot.Query().Where(adcreditlot.Reference(input.Reference)).Only(ctx); err == nil {
		return existing, false, nil
	} else if !ent.IsNotFound(err) {
		return nil, false, err
	}
	create := tx.AdCreditLot.Create().SetAccountID(input.AccountId).SetUserID(input.UserId).SetCurrency(input.Currency).SetSource(input.Source).
		SetOriginalMinor(input.AmountMinor).SetRemainingMinor(input.AmountMinor).SetReason(input.Reason).SetReference(input.Reference).
		SetIssuedByStaffID(input.StaffId).SetIssuedByName(input.StaffName).SetNillableExpiresAt(input.ExpiresAt).SetNillableBoostID(input.BoostId).SetNillableSpendBatchID(input.SpendBatchId)
	lot, err := create.Save(ctx)
	if err != nil {
		return nil, false, err
	}
	if err := tx.AdAccount.UpdateOneID(input.AccountId).AddCreditMinor(input.AmountMinor).Exec(ctx); err != nil {
		return nil, false, err
	}
	kind, transactionType := CreditChangeIssued, adfundstransaction.TypeCreditGrant
	if input.Source == adcreditlot.SourceCashback {
		kind, transactionType = CreditChangeCashback, adfundstransaction.TypeCashback
	}
	description := input.Description
	if description == "" {
		description = creditDescriptions[kind]
	}
	if err := recordCreditChange(ctx, tx, lot, kind, transactionType, input.AmountMinor, description, "creditLot:"+lot.ID.String(), now); err != nil {
		return nil, false, err
	}
	return lot, true, nil
}

var creditDescriptions = map[string]string{
	CreditChangeIssued: "Ad credit issued by Nantty", CreditChangeCashback: "Cashback on ad spend", CreditChangeExpired: "Ad credit expired",
	CreditChangeRevoked: "Ad credit removed by Nantty", CreditChangeCashbackReversed: "Cashback reversed after a refund",
}

func recordCreditChange(ctx context.Context, tx *ent.Tx, lot *ent.AdCreditLot, kind string, transactionType adfundstransaction.Type, signedMinor int64, description, reference string, now time.Time) error {
	if err := tx.AdFundsTransaction.Create().SetAccountID(lot.AccountID).SetType(transactionType).SetAmountMinor(signedMinor).SetCurrency(lot.Currency).
		SetDescription(description).SetReference(reference).Exec(ctx); err != nil {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdCreditChanged, lot.AccountID.String(), now, events.AdCreditChangedEventData{
		EntryId: reference, LotId: lot.ID.String(), AccountId: lot.AccountID.String(), UserId: lot.UserID.String(), Currency: lot.Currency,
		AmountMinor: signedMinor, Kind: kind, Source: string(lot.Source), IdempotencyKey: "adCredit:" + reference,
	})
}

func spendableLotsQuery(client *ent.Client, accountId uuid.UUID, now time.Time) *ent.AdCreditLotQuery {
	return client.AdCreditLot.Query().Where(adcreditlot.AccountID(accountId), adcreditlot.StatusEQ(adcreditlot.StatusActive), adcreditlot.RemainingMinorGT(0),
		adcreditlot.Or(adcreditlot.ExpiresAtIsNil(), adcreditlot.ExpiresAtGT(now))).
		Order(adcreditlot.ByExpiresAt(entsql.OrderNullsLast()), adcreditlot.ByID())
}

func SpendableCreditLots(ctx context.Context, client *ent.Client, accountId uuid.UUID, now time.Time) ([]*ent.AdCreditLot, error) {
	return spendableLotsQuery(client, accountId, now).All(ctx)
}

func SpendableCreditMinor(ctx context.Context, client *ent.Client, accountId uuid.UUID, now time.Time) (int64, error) {
	lots, err := SpendableCreditLots(ctx, client, accountId, now)
	total := int64(0)
	for _, lot := range lots {
		total += lot.RemainingMinor
	}
	return total, err
}

func ConsumeCreditInSpendOrder(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, wantedMinor int64, now time.Time) (int64, error) {
	if wantedMinor <= 0 {
		return 0, nil
	}
	lots, err := spendableLotsQuery(tx.Client(), accountId, now).ForUpdate().All(ctx)
	if err != nil {
		return 0, err
	}
	used := int64(0)
	for _, lot := range lots {
		if used == wantedMinor {
			break
		}
		take := min(lot.RemainingMinor, wantedMinor-used)
		update := tx.AdCreditLot.UpdateOneID(lot.ID).AddRemainingMinor(-take)
		if take == lot.RemainingMinor {
			update.SetStatus(adcreditlot.StatusSpent)
		}
		if err := update.Exec(ctx); err != nil {
			return 0, err
		}
		used += take
	}
	return used, nil
}

func RemoveCreditLotRemainderInTransaction(ctx context.Context, tx *ent.Tx, lotId uuid.UUID, kind, staffId, reason string, now time.Time) (*ent.AdCreditLot, int64, error) {
	lot, err := tx.AdCreditLot.Query().Where(adcreditlot.ID(lotId)).ForUpdate().Only(ctx)
	if err != nil || lot.Status != adcreditlot.StatusActive || lot.RemainingMinor <= 0 {
		return lot, 0, err
	}
	account, err := tx.AdAccount.Get(ctx, lot.AccountID)
	if err != nil {
		return nil, 0, err
	}
	removed := lot.RemainingMinor
	update := tx.AdCreditLot.UpdateOneID(lot.ID).SetRemainingMinor(0)
	transactionType, reference := adfundstransaction.TypeCreditRevoked, "creditRevoke:"+lot.ID.String()
	switch kind {
	case CreditChangeExpired:
		update.SetStatus(adcreditlot.StatusExpired).AddExpiredMinor(removed)
		transactionType, reference = adfundstransaction.TypeCreditExpired, "creditExpire:"+lot.ID.String()
	default:
		update.SetStatus(adcreditlot.StatusRevoked).AddRevokedMinor(removed).SetRevokedAt(now).SetRevokedByStaffID(staffId).SetRevokeReason(reason)
	}
	if lot, err = update.Save(ctx); err != nil {
		return nil, 0, err
	}
	if err := tx.AdAccount.UpdateOneID(account.ID).AddCreditMinor(-min(removed, account.CreditMinor)).Exec(ctx); err != nil {
		return nil, 0, err
	}
	return lot, removed, recordCreditChange(ctx, tx, lot, kind, transactionType, -removed, creditDescriptions[kind], reference, now)
}

func ReduceCreditLotInTransaction(ctx context.Context, tx *ent.Tx, lotId uuid.UUID, wantedMinor int64, kind, reference string, now time.Time) (int64, error) {
	lot, err := tx.AdCreditLot.Query().Where(adcreditlot.ID(lotId)).ForUpdate().Only(ctx)
	if err != nil || lot.RemainingMinor <= 0 || wantedMinor <= 0 {
		return 0, err
	}
	account, err := tx.AdAccount.Get(ctx, lot.AccountID)
	if err != nil {
		return 0, err
	}
	taken := min(wantedMinor, lot.RemainingMinor)
	update := tx.AdCreditLot.UpdateOneID(lot.ID).AddRemainingMinor(-taken).AddRevokedMinor(taken)
	if taken == lot.RemainingMinor {
		update.SetStatus(adcreditlot.StatusRevoked).SetRevokedAt(now)
	}
	if lot, err = update.Save(ctx); err != nil {
		return 0, err
	}
	if err := tx.AdAccount.UpdateOneID(account.ID).AddCreditMinor(-min(taken, account.CreditMinor)).Exec(ctx); err != nil {
		return 0, err
	}
	return taken, recordCreditChange(ctx, tx, lot, kind, adfundstransaction.TypeCashbackReversal, -taken, creditDescriptions[kind], reference, now)
}

func ExpireDueCreditLots(ctx context.Context, client *ent.Client, runInTransaction func(context.Context, func(*ent.Tx) error) error, now time.Time) (int, error) {
	due, err := client.AdCreditLot.Query().Where(adcreditlot.StatusEQ(adcreditlot.StatusActive), adcreditlot.RemainingMinorGT(0), adcreditlot.ExpiresAtLTE(now)).Limit(500).IDs(ctx)
	if err != nil {
		return 0, err
	}
	expired := 0
	for _, lotId := range due {
		err := runInTransaction(ctx, func(tx *ent.Tx) error {
			lot, err := tx.AdCreditLot.Query().Where(adcreditlot.ID(lotId)).ForUpdate().Only(ctx)
			if err != nil || lot.ExpiresAt == nil || lot.ExpiresAt.After(now) {
				return err
			}
			_, removed, err := RemoveCreditLotRemainderInTransaction(ctx, tx, lotId, CreditChangeExpired, "", "Expired", now)
			if removed > 0 {
				expired++
			}
			return err
		})
		if err != nil {
			return expired, err
		}
	}
	return expired, nil
}
