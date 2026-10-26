package getdispute

import (
	"context"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/modules/disputes/dtos"
	"nantty/modules/escrow/src/modules/disputes/services"
	"nantty/modules/escrow/src/modules/escrows"
	"nantty/modules/ledger/src/databases"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.DisputeDto, error) {
	return LoadDisputeForViewer(ctx, handler.Application, handler.Application.Container.Resources.Database, query)
}

func LoadDisputeForViewer(ctx context.Context, application *escrows.Application, executor databases.ExecutorQuerier, query Query) (dtos.DisputeDto, error) {
	client := application.Container.Client(executor)
	found, err := client.Dispute.Get(ctx, query.DisputeId)
	if ent.IsNotFound(err) {
		return dtos.DisputeDto{}, services.ErrDisputeNotFound
	}
	if err != nil {
		return dtos.DisputeDto{}, err
	}
	held, err := client.Escrow.Query().Where(escrow.ID(found.EscrowID)).Only(ctx)
	if err != nil {
		return dtos.DisputeDto{}, err
	}
	role := "support"
	if query.StoreId != "" {
		if held.StoreID != query.StoreId {
			return dtos.DisputeDto{}, services.ErrDisputeNotFound
		}
		role = "seller"
	} else if !query.AsStaff {
		participantRole, isParticipant := services.ParticipantRole(held, query.ViewerUserId)
		if !isParticipant {
			return dtos.DisputeDto{}, services.ErrDisputeNotFound
		}
		role = participantRole
	}
	return services.LoadDisputeView(ctx, client, found, held, role)
}
