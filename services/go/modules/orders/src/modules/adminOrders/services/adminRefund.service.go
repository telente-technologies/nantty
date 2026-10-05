package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/refundrecord"
	orderservices "zudomart/modules/orders/src/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type AdminRefund struct {
	Staff          staffauth.Staff
	OrderId        uuid.UUID
	AmountMinor    int64
	Currency       string
	Reason         string
	IdempotencyKey string
}

func (refund AdminRefund) RequestHash() string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%d|%s|%s", refund.OrderId, refund.AmountMinor, refund.Currency, refund.Reason)))
	return hex.EncodeToString(sum[:])
}

func CheckAdminRefund(group *ent.OrderGroup, escrowStatus string, amountMinor int64, currency string) error {
	if group.Status == enums.StatusDisputed || escrowStatus == "disputed" {
		return ordererrors.DisputeOpen
	}
	if group.PaymentStatus != enums.PaymentPaid {
		return ordererrors.NothingRefundable
	}
	if group.RefundRequestedAt != nil {
		return ordererrors.RefundInProgress
	}
	remaining := group.TotalMinor - group.RefundedMinor
	switch {
	case currency != group.Currency:
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amount.currency", Message: "must be the order currency " + group.Currency}})
	case amountMinor > remaining:
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amount.amountMinor", Message: "cannot be more than the refundable amount"}})
	}
	switch escrowStatus {
	case "held":
		return nil
	case "released":
		if amountMinor != remaining {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amount.amountMinor", Message: "a released order can only be refunded in full"}})
		}
		return nil
	}
	return ordererrors.NothingRefundable
}

func FindReplayedRefund(ctx context.Context, deployed *container.Container, refund AdminRefund) (*ent.RefundRecord, error) {
	existing, err := deployed.Client.RefundRecord.Query().Where(refundrecord.CreatedByAccountID(refund.Staff.Id), refundrecord.IdempotencyKey(refund.IdempotencyKey)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if existing.RequestHash != refund.RequestHash() {
		return nil, ordererrors.IdempotencyKeyReused
	}
	return existing, nil
}

func IssueAdminRefund(ctx context.Context, deployed *container.Container, refund AdminRefund, escrowStatus string) (*ent.RefundRecord, error) {
	var created *ent.RefundRecord
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		group, err := orderservices.LockOrderGroup(ctx, tx, refund.OrderId)
		if err != nil {
			return err
		}
		if err := CheckAdminRefund(group, escrowStatus, refund.AmountMinor, refund.Currency); err != nil {
			return err
		}
		now := deployed.Now()
		if err := tx.OrderGroup.UpdateOneID(group.ID).SetRefundRequestedAt(now).AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		actor := orderservices.OrderActor{Kind: "admin", Name: refund.Staff.Name}
		summary := fmt.Sprintf("Refund of %d %s (minor units) issued by Zudomart support: %s", refund.AmountMinor, group.Currency, refund.Reason)
		if err := orderservices.AppendTimelineEvent(ctx, tx, group.ID, "note", truncate(summary, 300), actor); err != nil {
			return err
		}
		key := refund.IdempotencyKey
		created, err = orderservices.EnqueueRefundRequest(ctx, tx, group, orderservices.RefundRequestRecord{
			AmountMinor: refund.AmountMinor, Currency: group.Currency, Reason: refund.Reason, EventReason: "Admin refund: " + refund.Reason, Source: orderservices.RefundSourceManual,
			CreatedById: refund.Staff.Id, CreatedByName: refund.Staff.Name, IdempotencyKey: &key, RequestHash: refund.RequestHash(),
		}, now)
		return err
	})
	if ent.IsConstraintError(err) {
		if replayed, findError := FindReplayedRefund(ctx, deployed, refund); findError == nil && replayed != nil {
			return replayed, nil
		}
	}
	return created, err
}

func truncate(text string, maximum int) string {
	runes := []rune(text)
	if len(runes) > maximum {
		return string(runes[:maximum])
	}
	return text
}
