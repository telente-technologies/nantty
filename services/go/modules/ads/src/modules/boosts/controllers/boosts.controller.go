package controllers

import (
	"zudomart/platform/regionpricing"

	"net/http"

	"zudomart/modules/ads/src/container"
	confirmboostpayment "zudomart/modules/ads/src/modules/boosts/commands/confirmBoostPayment"
	createboost "zudomart/modules/ads/src/modules/boosts/commands/createBoost"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	estimateboost "zudomart/modules/ads/src/modules/boosts/queries/estimateBoost"
	getboost "zudomart/modules/ads/src/modules/boosts/queries/getBoost"
	getboostoptions "zudomart/modules/ads/src/modules/boosts/queries/getBoostOptions"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

type BoostsController struct{ Container *container.Container }

func (controller BoostsController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller BoostsController) GetOptions(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		resolution := utils.ResolveChargingRegion(request, controller.Container.Countries.ProfileCountry(request.Context(), userId.String()))
		currency := resolution.Currency
		options, err := (getboostoptions.Handler{Container: controller.Container}).Execute(request.Context(), getboostoptions.Query{
			Currency: currency, Country: resolution.CountryCode, UserId: userId, Platform: request.Header.Get("X-Client-Platform"),
		})
		if err != nil {
			return err
		}
		writer.Header().Set("Cache-Control", "no-store")
		httpserver.WriteJsonResponse(writer, http.StatusOK, options)
		return nil
	})
}

func (controller BoostsController) Estimate(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		var body dtos.BoostEstimateRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		estimate, err := (estimateboost.Handler{Container: controller.Container}).Execute(request.Context(), estimateboost.Query{Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, estimate)
		return nil
	})
}

func (controller BoostsController) Create(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		var body dtos.CreateBoostRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		charging, err := regionpricing.RequireChargingCountry(utils.ResolveChargingRegion(request, controller.Container.Countries.ProfileCountry(request.Context(), userId.String())))
		if err != nil {
			return err
		}
		created, err := (createboost.Handler{Container: controller.Container}).Execute(request.Context(), createboost.Command{
			UserId: userId, IdempotencyKey: request.Header.Get("Idempotency-Key"), Country: charging, Platform: request.Header.Get("X-Client-Platform"), Request: body,
		})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, created)
		return nil
	})
}

func (controller BoostsController) Get(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		userId, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		boostId, err := utils.PathIdentifier(request, "boostId")
		if err != nil {
			return err
		}
		boost, err := (getboost.Handler{Container: controller.Container}).Execute(request.Context(), getboost.Query{BoostId: boostId, UserId: userId})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, boost)
		return nil
	})
}

func (controller BoostsController) ConfirmPayment(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		boostId, err := utils.PathIdentifier(request, "boostId")
		if err != nil {
			return err
		}
		var body struct {
			PaymentReference string `json:"paymentReference"`
		}
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := (confirmboostpayment.Handler{Container: controller.Container}).Execute(request.Context(), confirmboostpayment.Command{BoostId: boostId, PaymentReference: body.PaymentReference}); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}
