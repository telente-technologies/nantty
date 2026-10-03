package controllers

import (
	"context"
	"crypto/subtle"
	"net/http"
	"time"

	"github.com/google/uuid"

	usersErrors "zudomart/modules/users/src/errors"
	applybillingevent "zudomart/modules/users/src/modules/checkmarks/commands/applyBillingEvent"
	"zudomart/modules/users/src/modules/checkmarks/dtos"
	"zudomart/modules/users/src/modules/checkmarks/services"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/httpserver"
)

func (controller CheckmarksController) respondBlack(writer http.ResponseWriter, request *http.Request) {
	row, err := controller.Container.Client.BlackApplication.Get(request.Context(), uuid.MustParse(request.PathValue("blackId")))
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := services.BuildBlackApplicationView(request.Context(), controller.Container, row)
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller CheckmarksController) BillingEvent(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	profileId, err := uuid.Parse(request.PathValue("profileId"))
	if err != nil {
		controller.respond(writer, request, 0, nil, usersErrors.NotFound("That profile was not found."))
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.BillingEventRequest])
	if err == nil {
		var periodEnd *time.Time
		if body.PeriodEnd != nil {
			parsed, parseErr := time.Parse(time.RFC3339, *body.PeriodEnd)
			if parseErr != nil {
				err = usersErrors.ValidationFailedFor("currentPeriodEnd", "must be an RFC 3339 timestamp")
			}
			periodEnd = &parsed
		}
		if err == nil {
			err = applybillingevent.Handler{Container: controller.Container}.Execute(context.WithoutCancel(request.Context()), applybillingevent.Command{ProfileId: profileId, Event: body.Event, PeriodEnd: periodEnd, Price: priceOf(body.Price)})
		}
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func priceOf(price *struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}) *services.Price {
	if price == nil {
		return nil
	}
	return &services.Price{AmountMinor: price.AmountMinor, Currency: price.Currency}
}
