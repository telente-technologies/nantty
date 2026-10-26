package controllers

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	saverewardsettings "nantty/modules/orders/src/modules/storeRewards/commands/saveRewardSettings"
	"nantty/modules/orders/src/modules/storeRewards/dtos"
	getrewardsettings "nantty/modules/orders/src/modules/storeRewards/queries/getRewardSettings"
	getrewardssummary "nantty/modules/orders/src/modules/storeRewards/queries/getRewardsSummary"
	listmystorecredit "nantty/modules/orders/src/modules/storeRewards/queries/listMyStoreCredit"
	"nantty/modules/orders/src/modules/storeRewards/validators"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type StoreRewardsController struct {
	Container *container.Container
}

func (controller StoreRewardsController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}

func (controller StoreRewardsController) ListMyBalances(writer http.ResponseWriter, request *http.Request) {
	page, err := (listmystorecredit.Handler{Container: controller.Container}).Execute(request.Context(), listmystorecredit.Query{BuyerId: middlewares.AccountIdFrom(request.Context())})
	controller.respond(writer, request, page, err)
}

func (controller StoreRewardsController) GetSummary(writer http.ResponseWriter, request *http.Request) {
	summary, err := (getrewardssummary.Handler{Container: controller.Container}).Execute(request.Context(), getrewardssummary.Query{Store: middlewares.StoreAccessFrom(request.Context())})
	controller.respond(writer, request, summary, err)
}

func (controller StoreRewardsController) GetSettings(writer http.ResponseWriter, request *http.Request) {
	view, err := (getrewardsettings.Handler{Container: controller.Container}).Execute(request.Context(), getrewardsettings.Query{Store: middlewares.StoreAccessFrom(request.Context())})
	controller.respond(writer, request, view, err)
}

func (controller StoreRewardsController) PutSettings(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.RewardSettingsRequest](writer, request, validators.ValidateRewardSettings)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	view, err := (saverewardsettings.Handler{Container: controller.Container}).Execute(request.Context(), saverewardsettings.Command{Store: middlewares.StoreAccessFrom(request.Context()), Request: body})
	controller.respond(writer, request, view, err)
}
