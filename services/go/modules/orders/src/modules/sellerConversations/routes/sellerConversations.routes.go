package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/integrations"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/sellerConversations/controllers"
)

func MountSellerConversationsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SellerConversationsController{Container: deployed, Social: integrations.NewSocialStoreInboxClient(deployed.Settings.SocialInternalUrl, deployed.Settings.SocialInternalToken)}
	inbox := middlewares.StoreMember(deployed, "messages:manage", false)
	mux.Handle("GET /api/v1/seller/conversations", inbox(controller.List))
	mux.Handle("GET /api/v1/seller/conversations/{conversationId}", inbox(controller.Get))
	mux.Handle("POST /api/v1/seller/conversations/{conversationId}/messages", middlewares.StoreMemberWithOptionalKey(deployed, "messages:manage")(controller.Reply))
	mux.Handle("GET /api/v1/seller/conversations/{conversationId}/recipients", inbox(controller.Recipients))
	mux.Handle("POST /api/v1/seller/conversations/{conversationId}/read", inbox(controller.Read))
	mux.Handle("POST /api/v1/seller/orders/{orderId}/conversation", middlewares.StoreMember(deployed, "orders:manage", false)(controller.OpenForOrder))
}
