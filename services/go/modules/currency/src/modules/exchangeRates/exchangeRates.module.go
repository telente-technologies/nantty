package exchangerates

import (
	"context"
	"net/http"

	"zudomart/modules/currency/src/container"
	"zudomart/modules/currency/src/modules/exchangeRates/commands/seedDefaultRates"
	"zudomart/modules/currency/src/modules/exchangeRates/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountExchangeRatesRoutes(mux, container)
}

func SeedDefaultRates(ctx context.Context, container *container.Container) error {
	return seeddefaultrates.Handler{Container: container}.Execute(ctx, seeddefaultrates.Command{})
}
