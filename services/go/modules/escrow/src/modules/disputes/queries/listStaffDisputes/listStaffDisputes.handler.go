package liststaffdisputes

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/dispute"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/generated/ent/predicate"
	"nantty/modules/escrow/src/modules/disputes/dtos"
	"nantty/modules/escrow/src/modules/disputes/services"
	"nantty/modules/escrow/src/modules/escrows"
	ledgerutils "nantty/modules/ledger/src/utils"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.StaffDisputeListDto, error) {
	container := handler.Application.Container
	client := container.Client(container.Resources.Database)
	request := client.Dispute.Query()
	if len(query.Statuses) > 0 {
		statuses := make([]dispute.Status, len(query.Statuses))
		for index, status := range query.Statuses {
			statuses[index] = dispute.Status(status)
		}
		request.Where(dispute.StatusIn(statuses...))
	}
	if search := strings.TrimSpace(query.Search); search != "" {
		request.Where(searchPredicate(search))
	}
	oldestFirst := onlyOpenStatuses(query.Statuses)
	if query.AfterId != nil {
		if oldestFirst {
			request.Where(dispute.IDGT(*query.AfterId))
		} else {
			request.Where(dispute.IDLT(*query.AfterId))
		}
	}
	order := ent.Desc(dispute.FieldID)
	if oldestFirst {
		order = ent.Asc(dispute.FieldID)
	}
	rows, err := request.Order(order).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return dtos.StaffDisputeListDto{}, err
	}
	var nextCursor *string
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		cursor := rows[len(rows)-1].ID.String()
		nextCursor = &cursor
	}
	summaries, _, err := services.BuildStaffDisputeSummaries(ctx, container, client, rows)
	if err != nil {
		return dtos.StaffDisputeListDto{}, err
	}
	counts, err := services.CountDisputesByStatus(ctx, client)
	if err != nil {
		return dtos.StaffDisputeListDto{}, err
	}
	return dtos.StaffDisputeListDto{Data: summaries, NextCursor: nextCursor, Counts: counts}, nil
}

func searchPredicate(search string) predicate.Dispute {
	if ledgerutils.IsUuid(search) {
		identifier := strings.ToLower(search)
		return dispute.Or(
			dispute.OrderID(identifier),
			dispute.HasEscrowWith(escrow.Or(escrow.BuyerUserID(identifier), escrow.SellerUserID(identifier), escrow.StoreID(identifier))),
			dispute.IDEQ(uuid.MustParse(identifier)),
		)
	}
	return dispute.Or(dispute.OrderID(search), dispute.HasEscrowWith(escrow.OrderReferenceEqualFold(search)))
}

func onlyOpenStatuses(statuses []string) bool {
	if len(statuses) == 0 {
		return false
	}
	for _, status := range statuses {
		if status != string(dispute.StatusAwaitingSeller) && status != string(dispute.StatusUnderReview) {
			return false
		}
	}
	return true
}
