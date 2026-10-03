package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/notificationDirectory/controllers"
)

func MountNotificationDirectoryRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.NotificationDirectoryController{Container: container}
	mux.HandleFunc("GET /api/v1/internal/users/{accountId}/notification-recipient", controller.Recipient)
	mux.HandleFunc("GET /api/v1/internal/users/by-username/{username}/notification-recipient", controller.RecipientByUsername)
	mux.HandleFunc("GET /api/v1/internal/notification-audience/segments", controller.Segments)
	mux.HandleFunc("GET /api/v1/internal/notification-audience/{segmentId}", controller.AudiencePage)
	mux.HandleFunc("GET /api/v1/internal/notification-audience/{segmentId}/count", controller.AudienceCount)
	mux.HandleFunc("POST /api/v1/internal/users/{accountId}/marketing-unsubscribe", controller.MarketingUnsubscribe)
}
