package sellerconversations

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/sellerConversations/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerConversationsRoutes(mux, deployed)
}
