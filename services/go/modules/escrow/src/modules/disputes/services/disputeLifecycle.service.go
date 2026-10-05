package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/dispute"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/modules/escrows/models"
	escrowservices "zudomart/modules/escrow/src/modules/escrows/services"
	"zudomart/platform/httpserver"
)

var (
	ErrDisputeNotFound    = httpserver.NewApiError(http.StatusNotFound, "DISPUTE_NOT_FOUND", "Dispute was not found.")
	ErrOrderNotDisputable = httpserver.NewApiError(http.StatusConflict, "ORDER_NOT_DISPUTABLE", "This order can no longer be disputed.")
	ErrDisputeClosed      = httpserver.NewApiError(http.StatusConflict, "DISPUTE_CLOSED", "This dispute is closed.")
	ErrRefundCurrency     = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "refundAmount.currency", Message: "must be the order currency"}})
	activeDisputeStatuses = []dispute.Status{dispute.StatusAwaitingSeller, dispute.StatusUnderReview}
)

type DisputeService struct {
	Escrows escrowservices.EscrowService
}

type OpenDisputeInput struct {
	BuyerUserId  string
	OrderId      string
	Reason       string
	Description  string
	EvidenceUrls []string
}

func (service DisputeService) OpenDisputeInTransaction(ctx context.Context, transaction *sql.Tx, input OpenDisputeInput) (*ent.Dispute, error) {
	container := service.Escrows.Container
	client := container.Client(transaction)
	held, err := service.Escrows.LockEscrowForOrder(ctx, client, input.OrderId)
	if err != nil || held.BuyerUserID != input.BuyerUserId {
		return nil, escrowservices.ErrEscrowNotFound
	}
	active, err := client.Dispute.Query().Where(dispute.EscrowID(held.ID), dispute.StatusIn(activeDisputeStatuses...)).Only(ctx)
	if err == nil {
		return active, nil
	}
	if !ent.IsNotFound(err) {
		return nil, err
	}
	if held.Status != escrow.StatusHeld {
		return nil, ErrOrderNotDisputable
	}
	now := container.Now().UTC()
	freeze := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(escrow.StatusDisputed).ClearAutoReleaseAt()
	if held.AutoReleaseAt != nil {
		freeze.SetPausedReleaseRemainingSeconds(int64(max(held.AutoReleaseAt.Sub(now), 0).Seconds()))
	}
	if err := freeze.Exec(ctx); err != nil {
		return nil, err
	}
	evidence, _ := json.Marshal(nonNilStrings(input.EvidenceUrls))
	opened, err := client.Dispute.Create().
		SetEscrowID(held.ID).SetOrderID(held.OrderID).SetOpenedByUserID(input.BuyerUserId).SetReason(dispute.Reason(input.Reason)).
		SetDescription(input.Description).SetEvidenceUrls(evidence).SetRespondByAt(now.Add(container.Settings.SellerResponseWindow)).
		SetCreatedAt(now).Save(ctx)
	if err != nil {
		return nil, err
	}
	if err := service.recordStatus(ctx, client, opened.ID, "open", "Dispute opened — escrow release paused"); err != nil {
		return nil, err
	}
	if err := service.recordStatus(ctx, client, opened.ID, string(dispute.StatusAwaitingSeller), "Waiting for the seller to respond"); err != nil {
		return nil, err
	}
	if err := service.recordEscrowEvent(ctx, client, held.ID, "dispute_opened", "buyer", input.BuyerUserId, map[string]any{"disputeId": opened.ID.String(), "reason": input.Reason}); err != nil {
		return nil, err
	}
	return opened, container.Outbox.EnqueueInTransaction(ctx, transaction, "dispute.opened", opened.ID.String(), now, disputeEventData(opened, held))
}

type ResolveDisputeInput struct {
	DisputeId      uuid.UUID
	StaffId        string
	Outcome        string
	RefundMinor    int64
	RefundCurrency string
	Note           string
}

func (service DisputeService) ResolveDisputeInTransaction(ctx context.Context, transaction *sql.Tx, input ResolveDisputeInput) (*ent.Dispute, escrowservices.EscrowSettlementResult, error) {
	container := service.Escrows.Container
	client := container.Client(transaction)
	opened, held, err := service.lockDisputeWithEscrow(ctx, client, input.DisputeId)
	if err != nil {
		return nil, escrowservices.EscrowSettlementResult{}, err
	}
	if !slices.Contains(activeDisputeStatuses, opened.Status) {
		return nil, escrowservices.EscrowSettlementResult{}, ErrDisputeClosed
	}
	if input.RefundCurrency != "" && input.RefundCurrency != held.Currency {
		return nil, escrowservices.EscrowSettlementResult{}, ErrRefundCurrency
	}
	actor := escrowservices.EscrowActor{Type: "staff", Id: input.StaffId}
	var result escrowservices.EscrowSettlementResult
	status, label := dispute.StatusResolvedReleased, "Resolved — funds released to the seller"
	switch input.Outcome {
	case "release":
		result, err = service.Escrows.ReleaseEscrowInTransaction(ctx, transaction, held.OrderID, "disputeResolved", actor)
	case "refund":
		status, label = dispute.StatusResolvedRefunded, "Resolved — refunded to the buyer"
		result, err = service.Escrows.RefundEscrowInTransaction(ctx, transaction, held.OrderID, input.Note, actor)
	case "partial":
		status, label = dispute.StatusResolvedRefunded, "Resolved — partly refunded to the buyer"
		result, err = service.Escrows.ResolveEscrowPartiallyInTransaction(ctx, transaction, held.OrderID, input.RefundMinor, input.Note, actor)
	default:
		return nil, escrowservices.EscrowSettlementResult{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_OUTCOME", "Outcome must be release, refund or partial.")
	}
	if err != nil {
		return nil, escrowservices.EscrowSettlementResult{}, err
	}
	now := container.Now().UTC()
	resolved, err := opened.Update().Where(dispute.Version(opened.Version)).AddVersion(1).SetStatus(status).SetResolutionNote(input.Note).
		SetResolvedByStaffID(input.StaffId).SetResolvedAt(now).SetRefundAmountMinor(result.Escrow.RefundedMinor).Save(ctx)
	if err != nil {
		return nil, escrowservices.EscrowSettlementResult{}, err
	}
	if err := service.recordStatus(ctx, client, resolved.ID, string(status), label); err != nil {
		return nil, escrowservices.EscrowSettlementResult{}, err
	}
	if err := service.recordEscrowEvent(ctx, client, held.ID, "dispute_resolved", "staff", input.StaffId, map[string]any{"disputeId": resolved.ID.String(), "outcome": input.Outcome}); err != nil {
		return nil, escrowservices.EscrowSettlementResult{}, err
	}
	return resolved, result, container.Outbox.EnqueueInTransaction(ctx, transaction, "dispute.resolved", resolved.ID.String(), now, disputeEventData(resolved, result.Escrow))
}

func (service DisputeService) CloseDisputeByBuyerInTransaction(ctx context.Context, transaction *sql.Tx, buyerUserId string, disputeId uuid.UUID) (*ent.Dispute, error) {
	container := service.Escrows.Container
	client := container.Client(transaction)
	opened, held, err := service.lockDisputeWithEscrow(ctx, client, disputeId)
	if err != nil || opened.OpenedByUserID != buyerUserId {
		return nil, ErrDisputeNotFound
	}
	if !slices.Contains(activeDisputeStatuses, opened.Status) {
		return opened, nil
	}
	if err := models.AssertEscrowTransitionAllowed(models.EscrowStatus(held.Status), models.EscrowHeld); err != nil {
		return nil, err
	}
	now := container.Now().UTC()
	update := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(escrow.StatusHeld).ClearPausedReleaseRemainingSeconds()
	switch {
	case held.PausedReleaseRemainingSeconds != nil:
		update.SetAutoReleaseAt(now.Add(time.Duration(*held.PausedReleaseRemainingSeconds) * time.Second))
	case held.DeliveredAt != nil:
		update.SetAutoReleaseAt(now.Add(container.Policy(ctx).AutoReleasePeriod))
	}
	if err := update.Exec(ctx); err != nil {
		return nil, err
	}
	closed, err := opened.Update().AddVersion(1).SetStatus(dispute.StatusClosed).SetResolvedAt(now).Save(ctx)
	if err != nil {
		return nil, err
	}
	if err := service.recordStatus(ctx, client, closed.ID, string(dispute.StatusClosed), "Closed by the buyer — escrow release resumed"); err != nil {
		return nil, err
	}
	return closed, container.Outbox.EnqueueInTransaction(ctx, transaction, "dispute.closed", closed.ID.String(), now, disputeEventData(closed, held))
}

func (service DisputeService) lockDisputeWithEscrow(ctx context.Context, client *ent.Client, disputeId uuid.UUID) (*ent.Dispute, *ent.Escrow, error) {
	found, err := client.Dispute.Get(ctx, disputeId)
	if ent.IsNotFound(err) {
		return nil, nil, ErrDisputeNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	held, err := client.Escrow.Query().Where(escrow.ID(found.EscrowID)).ForUpdate().Only(ctx)
	if err != nil {
		return nil, nil, err
	}
	locked, err := client.Dispute.Query().Where(dispute.ID(disputeId)).ForUpdate().Only(ctx)
	return locked, held, err
}

func (service DisputeService) recordStatus(ctx context.Context, client *ent.Client, disputeId uuid.UUID, status, label string) error {
	return client.DisputeStatusEvent.Create().SetDisputeID(disputeId).SetStatus(status).SetLabel(label).SetCreatedAt(service.Escrows.Container.Now().UTC()).Exec(ctx)
}

func (service DisputeService) recordEscrowEvent(ctx context.Context, client *ent.Client, escrowId uuid.UUID, eventType, actorType, actorId string, details map[string]any) error {
	encoded, _ := json.Marshal(details)
	return client.EscrowEvent.Create().SetEscrowID(escrowId).SetEventType(eventType).SetActorType(actorType).SetActorID(actorId).
		SetDetails(encoded).SetCreatedAt(service.Escrows.Container.Now().UTC()).Exec(ctx)
}

func disputeEventData(found *ent.Dispute, held *ent.Escrow) map[string]any {
	return map[string]any{
		"disputeId": found.ID.String(), "orderId": found.OrderID, "escrowId": held.ID.String(), "status": string(found.Status),
		"buyerUserId": held.BuyerUserID, "sellerUserId": held.SellerUserID, "storeId": held.StoreID, "reason": string(found.Reason),
	}
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
