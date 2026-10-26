package controllers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent/livesession"
	"nantty/platform/httpserver"
)

func (controller InternalApiController) GetAccountActivityCounts(writer http.ResponseWriter, request *http.Request) {
	accountId, err := uuid.Parse(request.PathValue("accountId"))
	if err != nil {
		httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]int{"lives": 0})
		return
	}
	days, err := strconv.Atoi(request.URL.Query().Get("sinceDays"))
	if err != nil || days < 1 || days > 3660 {
		days = 365
	}
	since := time.Now().AddDate(0, 0, -days)
	lives, err := controller.Container.Client.LiveSession.Query().
		Where(livesession.HostID(accountId), livesession.StartedAtGTE(since)).Count(request.Context())
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]int{"lives": lives})
}
