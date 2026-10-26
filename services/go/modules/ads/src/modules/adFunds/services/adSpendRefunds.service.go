package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/events"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcreditlot"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	"nantty/modules/ads/src/generated/ent/adspendbatch"
	"nantty/modules/ads/src/modules/adFunds/dtos"
	adsservices "nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

func RefundAdSpend(ctx context.Context, deployed *container.Container, batchId uuid.UUID, request dtos.SpendRefundRequest) (dtos.SpendRefundResult, error) {
	reference := strings.TrimSpace(request.Reference)
	if request.AmountMinor <= 0 || reference == "" || len(reference) > 80 {
		return dtos.SpendRefundResult{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amountMinor", Message: "Send a positive amount and a reference of up to 80 characters."}})
	}
	result := dtos.SpendRefundResult{BatchId: batchId.String()}
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		batch, err := tx.AdSpendBatch.Query().Where(adspendbatch.ID(batchId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adserrors.NotFound
		}
		if err != nil {
			return err
		}
		key := "spendRefund:" + batch.ID.String() + ":" + reference
		if seen, err := tx.AdFundsTransaction.Query().Where(adfundstransaction.Reference(key)).Exist(ctx); err != nil || seen {
			result.RemainingRefundable = batch.DebitedMinor - batch.RefundedMinor
			return err
		}
		if request.AmountMinor > batch.DebitedMinor-batch.RefundedMinor {
			return adserrors.SpendRefundAboveDebited
		}
		creditPart := request.AmountMinor * batch.CreditUsedMinor / max(batch.DebitedMinor, 1)
		balancePart := request.AmountMinor - creditPart
		account, err := tx.AdAccount.Get(ctx, batch.AccountID)
		if err != nil {
			return err
		}
		now := deployed.Now()
		if balancePart > 0 {
			if err := tx.AdAccount.UpdateOneID(account.ID).AddBalanceMinor(balancePart).Exec(ctx); err != nil {
				return err
			}
			if err := tx.AdFundsTransaction.Create().SetAccountID(account.ID).SetType(adfundstransaction.TypeSpendRefund).SetAmountMinor(balancePart).SetCurrency(batch.Currency).
				SetDescription("Ad spend refunded").SetReference(key).Exec(ctx); err != nil {
				return err
			}
		}
		if creditPart > 0 {
			if _, _, err := adsservices.IssueCreditLotInTransaction(ctx, tx, adsservices.CreditLotInput{
				AccountId: account.ID, UserId: account.OwnerUserID, Currency: batch.Currency, Source: adcreditlot.SourceBoostRefund, AmountMinor: creditPart,
				Reason: "Refund of ad spend paid with credit", Reference: key + ":credit", SpendBatchId: &batch.ID, Description: "Refund of ad spend paid with credit",
			}, now); err != nil {
				return err
			}
		}
		reversed, err := reverseCashback(ctx, tx, batch, balancePart, key, now)
		if err != nil {
			return err
		}
		if err := tx.AdSpendBatch.UpdateOneID(batch.ID).AddRefundedMinor(request.AmountMinor).Exec(ctx); err != nil {
			return err
		}
		result.BalanceMinor, result.CreditMinor, result.CashbackReversed = balancePart, creditPart, reversed
		result.RemainingRefundable = batch.DebitedMinor - batch.RefundedMinor - request.AmountMinor
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdSpendRefunded, batch.ID.String(), now, events.AdSpendRefundedEventData{
			BatchId: batch.ID.String(), AccountId: account.ID.String(), Currency: batch.Currency, BalanceMinor: balancePart, CreditMinor: creditPart,
			Reason: request.Reason, IdempotencyKey: "adSpendRefund:" + key,
		})
	})
	return result, err
}

func reverseCashback(ctx context.Context, tx *ent.Tx, batch *ent.AdSpendBatch, balanceRefundMinor int64, key string, now time.Time) (int64, error) {
	realSpend := batch.DebitedMinor - batch.CreditUsedMinor
	if batch.CashbackMinor <= 0 || balanceRefundMinor <= 0 || realSpend <= 0 {
		return 0, nil
	}
	lot, err := tx.AdCreditLot.Query().Where(adcreditlot.Reference("cashback:" + batch.ID.String())).Only(ctx)
	if ent.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	wanted := batch.CashbackMinor * balanceRefundMinor / realSpend
	return adsservices.ReduceCreditLotInTransaction(ctx, tx, lot.ID, wanted, adsservices.CreditChangeCashbackReversed, key+":cashback", now)
}
