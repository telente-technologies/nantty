package liststaffdisputes

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/dispute"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/generated/ent/predicate"
	"zudomart/modules/escrow/src/modules/disputes/dtos"
	"zudomart/modules/escrow/src/modules/disputes/services"
	"zudomart/modules/escrow/src/modules/escrows"
	ledgerutils "zudomart/modules/ledger/src/utils"
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
	if query.AfterId != nil {
		request.Where(dispute.IDLT(*query.AfterId))
	}
	rows, err := request.Order(ent.Desc(dispute.FieldID)).Limit(query.Limit + 1).All(ctx)
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
