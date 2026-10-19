package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/adFunds/services"
	starttopup "zudomart/modules/ads/src/modules/billing/commands/startTopUp"
	billingdtos "zudomart/modules/ads/src/modules/billing/dtos"
	boostdtos "zudomart/modules/ads/src/modules/boosts/dtos"
	boostservices "zudomart/modules/ads/src/modules/boosts/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

type AdFundsController struct{ Container *container.Container }

func (controller AdFundsController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller AdFundsController) actorAndCurrency(request *http.Request) (uuid.UUID, string, string, error) {
	userId, err := utils.ActorUserId(request)
	if err != nil {
		return uuid.Nil, "", "", err
	}
	resolution := utils.ResolveChargingRegion(request, controller.Container.Countries.ProfileCountry(request.Context(), userId.String()))
	return userId, resolution.Currency, resolution.CountryCode, nil
}

func (controller AdFundsController) GetBalance(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, currency, _, err := controller.actorAndCurrency(request)
		if err != nil {
			return err
		}
		view, err := services.ReadAdBalanceView(request.Context(), controller.Container, userId, currency)
		if err != nil {
			return err
		}
		writer.Header().Set("Cache-Control", "no-store")
		httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		return nil
	})
}

func (controller AdFundsController) ListTransactions(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, currency, _, err := controller.actorAndCurrency(request)
		if err != nil {
			return err
		}
		cursor, err := utils.DecodeCursor(request)
		if err != nil {
			return err
		}
		limit, err := utils.PageLimit(request, 30)
		if err != nil {
			return err
		}
		items, next, err := services.ListAdBalanceTransactions(request.Context(), controller.Container, userId, currency, cursor, min(limit, 100))
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, next))
		return nil
	})
}

func (controller AdFundsController) StartTopUp(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, currency, country, err := controller.actorAndCurrency(request)
		if err != nil {
			return err
		}
		var body boostdtos.AdBalanceTopUpRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := adsservices.RequirePayoutVerified(request.Context(), controller.Container.Verification, userId.String()); err != nil {
			return err
		}
		account, err := boostservices.EnsurePersonalBoostAccount(request.Context(), controller.Container.Client, userId, currency, country)
		if err != nil {
			return err
		}
		command := starttopup.Command{AccountId: account.ID, UserId: userId, IdempotencyKey: request.Header.Get("Idempotency-Key"), Request: billingdtos.StartTopUpRequest{Amount: body.Amount}}
		if err := command.Validate(); err != nil {
			return err
		}
		checkout, err := (starttopup.Handler{Container: controller.Container}).Execute(request.Context(), command)
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, boostdtos.AdBalanceTopUp{TopUpId: checkout.TopUpId, Reference: checkout.Reference, CheckoutUrl: checkout.AuthorizationUrl})
		return nil
	})
}

func (controller AdFundsController) QuoteWithdrawal(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, currency, _, err := controller.actorAndCurrency(request)
		if err != nil {
			return err
		}
		var body boostdtos.AdBalanceWithdrawalRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		quote, err := services.QuoteAdBalanceWithdrawal(request.Context(), controller.Container, userId, currency, body.Amount)
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, quote)
		return nil
	})
}

func (controller AdFundsController) Withdraw(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, currency, _, err := controller.actorAndCurrency(request)
		if err != nil {
			return err
		}
		var body boostdtos.AdBalanceWithdrawalRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := middlewares.StepUpGate(controller.Container).RequireAlways(request); err != nil {
			return err
		}
		withdrawal, err := services.WithdrawAdBalance(request.Context(), controller.Container, userId, currency, request.Header.Get("Idempotency-Key"), body.Amount)
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, withdrawal)
		return nil
	})
}
