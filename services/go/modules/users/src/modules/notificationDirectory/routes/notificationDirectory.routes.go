package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/notificationDirectory/controllers"
	"nantty/platform/httpserver"
)

func MountNotificationDirectoryRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.NotificationDirectoryController{Container: container}
	internalToken := httpserver.RequireInternalToken(container.Settings.Privacy.InternalApiToken)
	mux.Handle("GET /api/v1/internal/users/{accountId}/notification-recipient", internalToken(http.HandlerFunc(controller.Recipient)))
	mux.Handle("GET /api/v1/internal/users/by-username/{username}/notification-recipient", internalToken(http.HandlerFunc(controller.RecipientByUsername)))
	mux.Handle("GET /api/v1/internal/notification-audience/segments", internalToken(http.HandlerFunc(controller.Segments)))
	mux.Handle("GET /api/v1/internal/notification-audience/{segmentId}", internalToken(http.HandlerFunc(controller.AudiencePage)))
	mux.Handle("GET /api/v1/internal/notification-audience/{segmentId}/count", internalToken(http.HandlerFunc(controller.AudienceCount)))
	mux.Handle("POST /api/v1/internal/users/{accountId}/marketing-unsubscribe", internalToken(http.HandlerFunc(controller.MarketingUnsubscribe)))
}
