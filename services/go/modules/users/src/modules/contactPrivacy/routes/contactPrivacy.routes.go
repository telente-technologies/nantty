package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/contactPrivacy/controllers"
	"nantty/platform/jwtauth"
)

func MountContactPrivacyRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.ContactPrivacyController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.Handle("GET /api/v1/users/me/mention-privacy", requireAccessToken(http.HandlerFunc(controller.GetMention)))
	mux.Handle("PUT /api/v1/users/me/mention-privacy", requireAccessToken(http.HandlerFunc(controller.PutMention)))
	mux.Handle("GET /api/v1/users/me/message-privacy", requireAccessToken(http.HandlerFunc(controller.GetMessage)))
	mux.Handle("PUT /api/v1/users/me/message-privacy", requireAccessToken(http.HandlerFunc(controller.PutMessage)))
	mux.HandleFunc("GET /api/v1/internal/accounts/{accountId}/contact-privacy", controller.Internal)
}
