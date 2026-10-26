package getreport

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (services.ReportResult, error) {
	return services.ProduceReport(ctx, handler.Container, services.ReportRequest{
		Store: query.Store, ActorId: query.ActorId, Kind: query.Kind, From: query.From, To: query.To, LocationId: query.LocationId,
	})
}
