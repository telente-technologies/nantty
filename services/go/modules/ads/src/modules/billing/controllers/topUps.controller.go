package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/middlewares"
	fundfromearnings "zudomart/modules/ads/src/modules/billing/commands/fundFromEarnings"
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

func (controller BillingController) FundFromEarnings(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.FundFromEarningsRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := middlewares.StepUpGate(controller.Container).RequireAbove(request, body.Amount.AmountMinor, body.Amount.Currency); err != nil {
			return err
		}
		funded, err := (fundfromearnings.Handler{Container: controller.Container}).Execute(request.Context(), fundfromearnings.Command{
			AccountId: account, UserId: user, IdempotencyKey: request.Header.Get("Idempotency-Key"), Amount: body.Amount,
		})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, funded)
		return nil
	})
}
