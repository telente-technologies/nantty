package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	starttopup "zudomart/modules/ads/src/modules/billing/commands/startTopUp"
	"zudomart/modules/ads/src/modules/billing/dtos"
	gettopup "zudomart/modules/ads/src/modules/billing/queries/getTopUp"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

func (controller BillingController) StartTopUp(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.StartTopUpRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		command := starttopup.Command{
			AccountId: account, UserId: user, Request: body, IdempotencyKey: request.Header.Get("Idempotency-Key"),
			BearerToken: strings.TrimSpace(strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer")),
		}
		if err := command.Validate(); err != nil {
			return err
		}
		checkout, err := (starttopup.Handler{Container: controller.Container}).Execute(request.Context(), command)
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, checkout)
		return nil
	})
}

func (controller BillingController) GetTopUp(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		reference := request.PathValue("reference")
		if reference == "" || len(reference) > 80 {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reference", Message: "is not valid"}})
		}
		topUp, err := (gettopup.Handler{Container: controller.Container}).Execute(request.Context(), gettopup.Query{AccountId: account, UserId: user, Reference: reference})
		if err != nil {
			return err
		}
		writer.Header().Set("Cache-Control", "no-store")
		httpserver.WriteJsonResponse(writer, http.StatusOK, topUp)
		return nil
	})
}
