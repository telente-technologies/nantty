package sellerconversations

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/sellerConversations/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerConversationsRoutes(mux, deployed)
}
