package services

import (
	"context"
	"database/sql"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/creators/src/generated/ent"
	"zudomart/modules/creators/src/generated/ent/affiliatecommission"
	"zudomart/modules/creators/src/generated/ent/affiliatecommissionreversal"
	programservices "zudomart/modules/creators/src/modules/creatorProgram/services"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
)

type EscrowRefunded struct {
	EscrowId string `json:"escrowId"`
	OrderId  string `json:"orderId"`
	Status   string `json:"status"`
	Amount   Money  `json:"amount"`
	Refunded Money  `json:"refunded"`
}

func CreatorEarningsDebtAccount(userId, currency string) ledgermodels.AccountRef {
	return ledgermodels.AccountRef{Code: "creator:" + userId + ":earningsDebt", Currency: currency, Kind: ledgermodels.AccountKindAsset, OwnerType: ledgermodels.OwnerTypeUser, OwnerId: userId}
}

func ReversalTarget(commissionMinor, refundedMinor, orderMinor int64) int64 {
	if orderMinor <= 0 || refundedMinor <= 0 {
		return 0
	}
	if refundedMinor >= orderMinor {
		return commissionMinor
	}
	return commissionMinor/orderMinor*refundedMinor + commissionMinor%orderMinor*refundedMinor/orderMinor
}

func (affiliates Affiliates) ReverseCommissionsForRefund(ctx context.Context, refund EscrowRefunded, eventType string) (int, error) {
	if refund.OrderId == "" || refund.EscrowId == "" {
		return 0, nil
	}
	commissions, err := affiliates.Container.Client(affiliates.Container.Resources.Database).AffiliateCommission.Query().Where(affiliatecommission.OrderID(refund.OrderId)).IDs(ctx)
	if err != nil {
		return 0, err
	}
	refundKey := refund.EscrowId + ":" + eventType + ":" + refund.Refunded.Currency + ":" + strconv.FormatInt(refund.Refunded.AmountMinor, 10)
	reversed := 0
	for _, id := range commissions {
		err := affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
			done, err := affiliates.reverseOne(ctx, transaction, client, id, refund, refundKey)
			if done {
				reversed++
			}
			return err
		})
		if err != nil {
			return reversed, err
		}
	}
	return reversed, nil
}

func (affiliates Affiliates) reverseOne(ctx context.Context, transaction *sql.Tx, client *ent.Client, id uuid.UUID, refund EscrowRefunded, refundKey string) (bool, error) {
	commissionId := id.String()
	commission, err := client.AffiliateCommission.Query().Where(affiliatecommission.IDEQ(id)).ForUpdate().Only(ctx)
	if err != nil {
		return false, err
	}
	seen, err := client.AffiliateCommissionReversal.Query().Where(affiliatecommissionreversal.CommissionID(commissionId), affiliatecommissionreversal.RefundKey(refundKey)).Exist(ctx)
	if err != nil || seen || !strings.EqualFold(refund.Refunded.Currency, commission.Currency) {
		return false, err
	}
	amount := ReversalTarget(commission.CommissionMinor, refund.Refunded.AmountMinor, refund.Amount.AmountMinor) - commission.ReversedMinor
	if amount <= 0 {
		return false, nil
	}
	payable := ledgermodels.CreatorEarningsPayableAccount(commission.CreatorID, commission.Currency)
	balance, err := affiliates.Container.Ledger.ReadAccountBalance(ctx, transaction, payable)
	if err != nil {
		return false, err
	}
	recovered := min(max(balance, 0), amount)
	lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.SellerAvailableAccount(commission.SellerUserID, commission.Currency), Direction: ledgermodels.Credit, AmountMinor: amount}}
	if recovered > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: payable, Direction: ledgermodels.Debit, AmountMinor: recovered})
	}
	if shortfall := amount - recovered; shortfall > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: CreatorEarningsDebtAccount(commission.CreatorID, commission.Currency), Direction: ledgermodels.Debit, AmountMinor: shortfall})
	}
	reference := "affiliate-commission-reversal:" + commissionId + ":" + refundKey
	if _, err := affiliates.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "affiliateCommission.reversed", Description: "Affiliate commission returned after a refund", Lines: lines,
		Metadata: map[string]any{"commissionId": commissionId, "orderId": commission.OrderID, "escrowId": refund.EscrowId, "shortfallMinor": amount - recovered},
	}); err != nil {
		return false, err
	}
	now := affiliates.Container.Now().UTC()
	if err := client.AffiliateCommissionReversal.Create().SetCommissionID(commissionId).SetRefundKey(refundKey).SetAmountMinor(amount).SetRecoveredMinor(recovered).
		SetShortfallMinor(amount - recovered).SetCreatedAt(now).Exec(ctx); err != nil {
		return false, err
	}
	update := commission.Update().AddReversedMinor(amount)
	if commission.ReversedMinor+amount >= commission.CommissionMinor {
		update.SetStatus(affiliatecommission.StatusReversed)
	}
	if err := update.Exec(ctx); err != nil {
		return false, err
	}
	if _, err := programservices.RecordEarning(ctx, client, programservices.Earning{
		CreatorId: commission.CreatorID, Kind: "affiliate", Reference: reference, SourceType: commission.AttributionSource, SourceId: commission.AttributionID,
		Description: "Affiliate commission reversed after a refund", GrossMinor: -amount, NetMinor: -amount, Unit: commission.Currency, At: now,
	}); err != nil {
		return false, err
	}
	return true, affiliates.Container.Outbox.EnqueueInTransaction(ctx, transaction, "affiliateCommission.reversed", commission.CreatorID, now, map[string]any{
		"commissionId": commissionId, "creatorId": commission.CreatorID, "orderId": commission.OrderID, "amount": Money{amount, commission.Currency},
		"recovered": Money{recovered, commission.Currency}, "shortfall": Money{amount - recovered, commission.Currency},
	})
}
