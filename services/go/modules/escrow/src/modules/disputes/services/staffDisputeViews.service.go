package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/container"
	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/dispute"
	"nantty/modules/escrow/src/generated/ent/disputemessage"
	"nantty/modules/escrow/src/generated/ent/disputestatusevent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/modules/disputes/dtos"
	escrowdtos "nantty/modules/escrow/src/modules/escrows/dtos"
)

const urgentWhenDueWithin = 12 * time.Hour

func BuildStaffDisputeSummaries(ctx context.Context, settings *container.Container, client *ent.Client, rows []*ent.Dispute) ([]dtos.StaffDisputeSummaryDto, map[uuid.UUID]*ent.Escrow, error) {
	escrowIds, disputeIds := make([]uuid.UUID, len(rows)), make([]uuid.UUID, len(rows))
	for index, row := range rows {
		escrowIds[index], disputeIds[index] = row.EscrowID, row.ID
	}
	escrows, err := client.Escrow.Query().Where(escrow.IDIn(escrowIds...)).All(ctx)
	if err != nil {
		return nil, nil, err
	}
	byEscrowId := map[uuid.UUID]*ent.Escrow{}
	accountIds, storeIds := []string{}, []string{}
	for _, held := range escrows {
		byEscrowId[held.ID] = held
		accountIds = append(accountIds, held.BuyerUserID, held.SellerUserID)
		storeIds = append(storeIds, held.StoreID)
	}
	reviewStarted, err := reviewStartTimes(ctx, client, disputeIds)
	if err != nil {
		return nil, nil, err
	}
	parties := settings.Parties.DescribeAccounts(ctx, accountIds)
	stores := settings.Parties.DescribeStores(ctx, storeIds)
	now := settings.Now().UTC()
	summaries := make([]dtos.StaffDisputeSummaryDto, 0, len(rows))
	for _, row := range rows {
		held := byEscrowId[row.EscrowID]
		if held == nil {
			continue
		}
		summary := dtos.StaffDisputeSummaryDto{
			Id: row.ID.String(), OrderId: row.OrderID, OrderNumber: held.OrderReference, ProductName: held.ProductSummary,
			Buyer: parties[held.BuyerUserID], Seller: parties[held.SellerUserID], Store: stores[held.StoreID],
			Reason: string(row.Reason), Status: string(row.Status), Priority: "normal", OpenedAt: row.CreatedAt, AgeHours: int(now.Sub(row.CreatedAt).Hours()),
			EscrowAmount: escrowdtos.MoneyDto{AmountMinor: held.AmountMinor, Currency: held.Currency},
		}
		summary.SlaDueAt = slaDueAt(row, reviewStarted[row.ID], settings.Settings.StaffReviewWindow)
		if summary.SlaDueAt != nil {
			summary.IsSlaBreached = now.After(*summary.SlaDueAt)
			switch {
			case summary.IsSlaBreached:
				summary.Priority = "urgent"
			case summary.SlaDueAt.Sub(now) <= urgentWhenDueWithin:
				summary.Priority = "high"
			}
		}
		summaries = append(summaries, summary)
	}
	return summaries, byEscrowId, nil
}

func slaDueAt(row *ent.Dispute, reviewStartedAt *time.Time, reviewWindow time.Duration) *time.Time {
	switch row.Status {
	case dispute.StatusAwaitingSeller:
		return row.RespondByAt
	case dispute.StatusUnderReview:
		started := row.UpdatedAt
		if reviewStartedAt != nil {
			started = *reviewStartedAt
		}
		due := started.Add(reviewWindow)
		return &due
	}
	return nil
}

func reviewStartTimes(ctx context.Context, client *ent.Client, disputeIds []uuid.UUID) (map[uuid.UUID]*time.Time, error) {
	started := map[uuid.UUID]*time.Time{}
	if len(disputeIds) == 0 {
		return started, nil
	}
	events, err := client.DisputeStatusEvent.Query().Where(disputestatusevent.DisputeIDIn(disputeIds...), disputestatusevent.Status(string(dispute.StatusUnderReview))).
		Order(ent.Asc(disputestatusevent.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, event := range events {
		createdAt := event.CreatedAt
		started[event.DisputeID] = &createdAt
	}
	return started, nil
}

func LoadStaffDisputeDetail(ctx context.Context, settings *container.Container, client *ent.Client, found *ent.Dispute) (dtos.StaffDisputeDetailDto, error) {
	summaries, escrows, err := BuildStaffDisputeSummaries(ctx, settings, client, []*ent.Dispute{found})
	if err != nil || len(summaries) == 0 {
		return dtos.StaffDisputeDetailDto{}, firstError(err, ErrDisputeNotFound)
	}
	held := escrows[found.EscrowID]
	participantView, err := LoadDisputeView(ctx, client, found, held, "support")
	if err != nil {
		return dtos.StaffDisputeDetailDto{}, err
	}
	money := func(amount int64) escrowdtos.MoneyDto {
		return escrowdtos.MoneyDto{AmountMinor: amount, Currency: held.Currency}
	}
	stillHeld := held.AmountMinor - held.RefundedMinor - held.ReleasedToSellerMinor
	if held.Status != escrow.StatusHeld && held.Status != escrow.StatusDisputed {
		stillHeld = 0
	}
	detail := dtos.StaffDisputeDetailDto{
		StaffDisputeSummaryDto: summaries[0], Description: found.Description, EvidenceUrls: participantView.EvidenceUrls,
		CommissionBasisPoints: held.CommissionBps, Messages: participantView.Messages, History: participantView.StatusHistory,
		Escrow: dtos.StaffDisputeEscrowDto{
			EscrowId: held.ID.String(), Status: string(held.Status), Amount: money(held.AmountMinor), HeldAmount: money(max(stillHeld, 0)),
			RefundedAmount: money(held.RefundedMinor), ReleasedAmount: money(held.ReleasedToSellerMinor), Commission: money(held.CommissionMinor),
			ProcessingFee: money(held.ProcessingFeeMinor), PaymentReference: held.PaymentReference, DeliveredAt: held.DeliveredAt,
		},
	}
	firstSellerMessage, err := client.DisputeMessage.Query().Where(disputemessage.DisputeID(found.ID), disputemessage.AuthorRoleEQ(disputemessage.AuthorRoleSeller)).
		Order(ent.Asc(disputemessage.FieldCreatedAt)).First(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return dtos.StaffDisputeDetailDto{}, err
	}
	if firstSellerMessage != nil {
		detail.SellerResponse = &firstSellerMessage.Text
	}
	detail.Resolution = buildResolution(found, held)
	return detail, nil
}

func buildResolution(found *ent.Dispute, held *ent.Escrow) *dtos.DisputeResolutionDto {
	outcome := map[dispute.Status]string{dispute.StatusResolvedReleased: "release", dispute.StatusResolvedRefunded: "refund", dispute.StatusClosed: "withdrawn"}[found.Status]
	if outcome == "" {
		return nil
	}
	if outcome == "refund" && held.RefundedMinor < held.AmountMinor {
		outcome = "partial"
	}
	money := func(amount int64) escrowdtos.MoneyDto {
		return escrowdtos.MoneyDto{AmountMinor: amount, Currency: held.Currency}
	}
	commission := int64(0)
	if outcome == "release" || outcome == "partial" {
		commission = max(held.AmountMinor-held.RefundedMinor-held.ReleasedToSellerMinor-held.ProcessingFeeMinor, 0)
	}
	resolution := &dtos.DisputeResolutionDto{
		Outcome: outcome, BuyerRefund: money(held.RefundedMinor), SellerPayout: money(held.ReleasedToSellerMinor), Commission: money(commission),
		Note: found.ResolutionNote, ResolvedAt: found.ResolvedAt,
	}
	if found.ResolvedByStaffID != "" {
		staffId := found.ResolvedByStaffID
		resolution.ResolvedByStaffId = &staffId
	}
	return resolution
}

func CountDisputesByStatus(ctx context.Context, client *ent.Client) (map[string]int, error) {
	counts := map[string]int{}
	for _, status := range []dispute.Status{dispute.StatusAwaitingSeller, dispute.StatusUnderReview, dispute.StatusResolvedRefunded, dispute.StatusResolvedReleased, dispute.StatusClosed} {
		counts[string(status)] = 0
	}
	var rows []struct {
		Status string `json:"status"`
		Count  int    `json:"count"`
	}
	if err := client.Dispute.Query().GroupBy(dispute.FieldStatus).Aggregate(ent.Count()).Scan(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[row.Status] = row.Count
	}
	return counts, nil
}

func firstError(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}
