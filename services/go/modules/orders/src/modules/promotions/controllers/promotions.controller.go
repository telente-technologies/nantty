package controllers

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	deletepromotion "zudomart/modules/orders/src/modules/promotions/commands/deletePromotion"
	savepromotion "zudomart/modules/orders/src/modules/promotions/commands/savePromotion"
	"zudomart/modules/orders/src/modules/promotions/dtos"
	getpromotion "zudomart/modules/orders/src/modules/promotions/queries/getPromotion"
	listpromotions "zudomart/modules/orders/src/modules/promotions/queries/listPromotions"
	validatepromotioncode "zudomart/modules/orders/src/modules/promotions/queries/validatePromotionCode"
	"zudomart/modules/orders/src/modules/promotions/validators"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type PromotionsController struct {
	Container *container.Container
}

func (controller PromotionsController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller PromotionsController) List(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 50, 200)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	query := request.URL.Query()
	page, err := (listpromotions.Handler{Container: controller.Container}).Execute(request.Context(), listpromotions.Query{
		Store: middlewares.StoreAccessFrom(request.Context()), Status: query.Get("status"), Kind: query.Get("kind"), Text: query.Get("q"), Cursor: query.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller PromotionsController) Create(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.PromotionRequest](writer, request, validators.ValidateCreatePromotion)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (savepromotion.Handler{Container: controller.Container}).Execute(request.Context(), savepromotion.Command{Store: middlewares.StoreAccessFrom(request.Context()), Request: body})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller PromotionsController) Update(writer http.ResponseWriter, request *http.Request) {
	promotionId, err := utils.PathIdentifier(request, "promotionId")
	var body dtos.PromotionRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.PromotionRequest](writer, request, validators.ValidateUpdatePromotion)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (savepromotion.Handler{Container: controller.Container}).Execute(request.Context(), savepromotion.Command{Store: middlewares.StoreAccessFrom(request.Context()), PromotionId: &promotionId, Request: body})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller PromotionsController) Get(writer http.ResponseWriter, request *http.Request) {
	promotionId, err := utils.PathIdentifier(request, "promotionId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (getpromotion.Handler{Container: controller.Container}).Execute(request.Context(), getpromotion.Query{Store: middlewares.StoreAccessFrom(request.Context()), PromotionId: promotionId})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller PromotionsController) Delete(writer http.ResponseWriter, request *http.Request) {
	promotionId, err := utils.PathIdentifier(request, "promotionId")
	if err == nil {
		err = (deletepromotion.Handler{Container: controller.Container}).Execute(request.Context(), deletepromotion.Command{Store: middlewares.StoreAccessFrom(request.Context()), PromotionId: promotionId})
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller PromotionsController) ValidateCode(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ValidateCodeRequest](writer, request, validators.ValidateCodeCheck)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (validatepromotioncode.Handler{Container: controller.Container}).Execute(request.Context(),
		validatepromotioncode.Query{Store: middlewares.StoreAccessFrom(request.Context()), Code: body.Code, SubtotalMinor: body.SubtotalMinor})
	controller.respond(writer, request, http.StatusOK, view, err)
}
