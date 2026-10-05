package services

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/platform/httpserver"
)

var sellerRefundableStatuses = []string{enums.StatusNew, enums.StatusProcessing, enums.StatusReady, enums.StatusShipped, enums.StatusDelivered, enums.StatusCompleted}

type SellerRefundRequest struct {
	AmountMinor int64
	Reason      string
}

func CheckSellerRefund(group *ent.OrderGroup, escrowStatus string, amountMinor int64) error {
	if group.Status == enums.StatusDisputed || escrowStatus == "disputed" {
		return ordererrors.OrderRefundDisputed
	}
	if !slices.Contains(sellerRefundableStatuses, group.Status) || group.PaymentStatus != enums.PaymentPaid || group.RefundRequestedAt != nil || group.RefundedMinor > 0 {
		return ordererrors.OrderNotRefundable
	}
	if amountMinor <= 0 {
		return ordererrors.RefundAmountInvalid
	}
	remaining := group.TotalMinor - group.RefundedMinor
	if amountMinor > remaining {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amountMinor", Message: "You cannot refund more than the buyer paid."}})
	}
	switch escrowStatus {
	case "held":
		return nil
	case "released":
		if amountMinor != remaining {
			return ordererrors.OrderRefundOnlyInFull
		}
		return nil
	}
	return ordererrors.OrderNotRefundable
}

func RefundSellerOrder(ctx context.Context, deployed *container.Container, seller SellerContext, orderId uuid.UUID, request SellerRefundRequest) error {
	group, err := LoadStoreOrder(ctx, deployed, seller.Store.StoreId, orderId)
	if err != nil {
		return err
	}
	escrow, err := deployed.Money.GetOrderEscrow(ctx, group.ID.String())
	if err != nil {
		return ordererrors.OrderNotRefundable
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := lockStoreOrder(ctx, tx, seller.Store.StoreId, orderId)
		if err != nil {
			return err
		}
		if err := CheckSellerRefund(locked, escrow.Status, request.AmountMinor); err != nil {
			return err
		}
		now := deployed.Now()
		if err := tx.OrderGroup.UpdateOneID(locked.ID).SetRefundRequestedAt(now).AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		summary := fmt.Sprintf("Refund of %d %s (minor units) requested by the seller: %s", request.AmountMinor, locked.Currency, request.Reason)
		if err := AppendTimelineEvent(ctx, tx, locked.ID, "note", summary, seller.actor()); err != nil {
			return err
		}
		_, err = EnqueueRefundRequest(ctx, tx, locked, RefundRequestRecord{AmountMinor: request.AmountMinor, Currency: locked.Currency, Reason: request.Reason,
			EventReason: "Seller refund: " + request.Reason, Source: RefundSourceSeller, CreatedById: seller.ActorId.String(), CreatedByName: seller.Name}, now)
		return err
	})
}
