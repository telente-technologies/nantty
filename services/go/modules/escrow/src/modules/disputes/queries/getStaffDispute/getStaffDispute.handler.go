package getstaffdispute

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/modules/disputes/dtos"
	"nantty/modules/escrow/src/modules/disputes/services"
	"nantty/modules/escrow/src/modules/escrows"
	"nantty/modules/ledger/src/databases"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.StaffDisputeDetailDto, error) {
	return LoadStaffDispute(ctx, handler.Application, handler.Application.Container.Resources.Database, query.DisputeId)
}

func LoadStaffDispute(ctx context.Context, application *escrows.Application, executor databases.ExecutorQuerier, disputeId uuid.UUID) (dtos.StaffDisputeDetailDto, error) {
	client := application.Container.Client(executor)
	found, err := client.Dispute.Get(ctx, disputeId)
	if ent.IsNotFound(err) {
		return dtos.StaffDisputeDetailDto{}, services.ErrDisputeNotFound
	}
	if err != nil {
		return dtos.StaffDisputeDetailDto{}, err
	}
	return services.LoadStaffDisputeDetail(ctx, application.Container, client, found)
}
