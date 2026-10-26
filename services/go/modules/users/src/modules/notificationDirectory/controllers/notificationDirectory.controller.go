package controllers

import (
	"crypto/subtle"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	withdrawmarketingconsent "nantty/modules/users/src/modules/notificationDirectory/commands/withdrawMarketingConsent"
	"nantty/modules/users/src/modules/notificationDirectory/services"
	"nantty/platform/httpserver"
)

type NotificationDirectoryController struct {
	Container *container.Container
}

func (controller NotificationDirectoryController) authorized(writer http.ResponseWriter, request *http.Request) bool {
	presented := []byte(request.Header.Get("X-Internal-Token"))
	for _, expected := range []string{controller.Container.Settings.Privacy.NotificationServiceToken, controller.Container.Settings.Privacy.InternalApiToken} {
		if len(expected) >= 32 && subtle.ConstantTimeCompare([]byte(expected), presented) == 1 {
			return true
		}
	}
	httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
	return false
}

func (controller NotificationDirectoryController) respond(writer http.ResponseWriter, request *http.Request, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller NotificationDirectoryController) Recipient(writer http.ResponseWriter, request *http.Request) {
	if !controller.authorized(writer, request) {
		return
	}
	accountId, parseErr := uuid.Parse(request.PathValue("accountId"))
	if parseErr != nil {
		controller.respond(writer, request, nil, usersErrors.NotFound("That account was not found."))
		return
	}
	recipient, found, err := services.FindRecipient(request.Context(), controller.Container, accountId)
	if err == nil && !found {
		err = usersErrors.NotFound("That account was not found.")
	}
	controller.respond(writer, request, recipient, err)
}

func (controller NotificationDirectoryController) RecipientByUsername(writer http.ResponseWriter, request *http.Request) {
	if !controller.authorized(writer, request) {
		return
	}
	recipient, found, err := services.FindRecipientByUsername(request.Context(), controller.Container, request.PathValue("username"))
	if err == nil && !found {
		err = usersErrors.NotFound("That account was not found.")
	}
	controller.respond(writer, request, recipient, err)
}

func (controller NotificationDirectoryController) Segments(writer http.ResponseWriter, request *http.Request) {
	if !controller.authorized(writer, request) {
		return
	}
	segments, err := services.ListSegments(request.Context(), controller.Container)
	controller.respond(writer, request, map[string]any{"data": segments, "nextCursor": nil}, err)
}

func (controller NotificationDirectoryController) AudiencePage(writer http.ResponseWriter, request *http.Request) {
	if !controller.authorized(writer, request) {
		return
	}
	limit, _ := strconv.Atoi(request.URL.Query().Get("limit"))
	if limit < 1 || limit > 500 {
		limit = 100
	}
	recipients, next, found, err := services.ListAudiencePage(request.Context(), controller.Container, request.PathValue("segmentId"), request.URL.Query().Get("cursor"), limit)
	if err == nil && !found {
		err = usersErrors.NotFound("That segment does not exist.")
	}
	controller.respond(writer, request, map[string]any{"data": recipients, "nextCursor": next}, err)
}

func (controller NotificationDirectoryController) AudienceCount(writer http.ResponseWriter, request *http.Request) {
	if !controller.authorized(writer, request) {
		return
	}
	total, marketing, found, err := services.CountSegment(request.Context(), controller.Container, request.PathValue("segmentId"))
	if err == nil && !found {
		err = usersErrors.NotFound("That segment does not exist.")
	}
	controller.respond(writer, request, map[string]int{"total": total, "marketingConsentCount": marketing}, err)
}

func (controller NotificationDirectoryController) MarketingUnsubscribe(writer http.ResponseWriter, request *http.Request) {
	if !controller.authorized(writer, request) {
		return
	}
	accountId, parseErr := uuid.Parse(request.PathValue("accountId"))
	if parseErr != nil {
		controller.respond(writer, request, nil, usersErrors.NotFound("That account was not found."))
		return
	}
	err := withdrawmarketingconsent.Handler{Container: controller.Container}.Execute(request.Context(), accountId)
	controller.respond(writer, request, map[string]bool{"unsubscribed": true}, err)
}
