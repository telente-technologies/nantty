package reconcileproviderbalances

import (
	"context"

	"nantty/modules/payments/src/modules/gateway"
	"nantty/modules/payments/src/modules/gateway/services"
)

type Handler struct {
	Application *gateway.Application
}

func (handler Handler) Execute(ctx context.Context, _ Command) (services.ProviderMirrorReport, error) {
	return handler.Application.Gateway.ReconcileProviderMirror(ctx)
}
