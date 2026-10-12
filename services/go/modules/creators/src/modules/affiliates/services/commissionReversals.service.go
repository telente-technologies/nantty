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
)

type EscrowRefunded struct {
	EscrowId string `json:"escrowId"`
	OrderId  string `json:"orderId"`
	Status   string `json:"status"`
	Amount   Money  `json:"amount"`
	Refunded Money  `json:"refunded"`
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
	reference := "affiliate-commission-reversal:" + commissionId + ":" + refundKey
	var recovered, shortfall int64
	applied := true
	switch commission.Status {
	case affiliatecommission.StatusPending:
	case affiliatecommission.StatusProcessing:
		applied = false
	default:
		if recovered, shortfall, err = affiliates.clawBackInTransaction(ctx, transaction, commission, amount, refundKey); err != nil {
			return false, err
		}
	}
	now := affiliates.Container.Now().UTC()
	if err := client.AffiliateCommissionReversal.Create().SetCommissionID(commissionId).SetRefundKey(refundKey).SetAmountMinor(amount).SetRecoveredMinor(recovered).
		SetShortfallMinor(shortfall).SetApplied(applied).SetCreatedAt(now).Exec(ctx); err != nil {
		return false, err
	}
	update := commission.Update().AddReversedMinor(amount)
	if commission.ReversedMinor+amount >= commission.CommissionMinor && commission.Status != affiliatecommission.StatusProcessing {
		update.SetStatus(affiliatecommission.StatusReversed)
	}
	if err := update.Exec(ctx); err != nil {
		return false, err
	}
	if _, err := programservices.RecordEarning(ctx, client, programservices.Earning{
		CreatorId: commission.CreatorID, Kind: "affiliate", Reference: reference, SourceType: commission.AttributionSource, SourceId: commission.AttributionID,
		Description: CreatorCommissionReversalDescription(commission), GrossMinor: -amount, NetMinor: -amount, Unit: commission.Currency, At: now,
	}); err != nil {
		return false, err
	}
	return true, affiliates.Container.Outbox.EnqueueInTransaction(ctx, transaction, "affiliateCommission.reversed", commission.CreatorID, now, map[string]any{
		"commissionId": commissionId, "creatorId": commission.CreatorID, "orderId": commission.OrderID, "amount": Money{amount, commission.Currency},
		"recovered": Money{recovered, commission.Currency}, "shortfall": Money{shortfall, commission.Currency},
	})
}
