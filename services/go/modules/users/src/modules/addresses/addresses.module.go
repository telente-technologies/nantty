package addresses

import (
	"context"
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/addresses/routes"
	"zudomart/modules/users/src/modules/addresses/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAddressesRoutes(mux, c)
}

func SealPlaintextPhones(ctx context.Context, c *container.Container) error {
	return services.SealPlaintextPhones(ctx, c.Client, c.Settings.AddressPhoneKey)
}
