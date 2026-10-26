package controllers

import (
	"net/http"
	"slices"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	updatestoresettings "nantty/modules/catalog/src/modules/storeSettings/commands/updateStoreSettings"
	updatestorefront "nantty/modules/catalog/src/modules/storeSettings/commands/updateStorefront"
	"nantty/modules/catalog/src/modules/storeSettings/dtos"
	getstoresettings "nantty/modules/catalog/src/modules/storeSettings/queries/getStoreSettings"
	getstorefront "nantty/modules/catalog/src/modules/storeSettings/queries/getStorefront"
	"nantty/modules/catalog/src/modules/storeSettings/services"
	"nantty/modules/catalog/src/modules/storeSettings/validators"
	catalogservices "nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/sellerplans"
)

type StoreSettingsController struct {
	Container *container.Container
}

func (controller StoreSettingsController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}

func (controller StoreSettingsController) actorOf(request *http.Request) catalogservices.StoreActor {
	store := middlewares.StoreAccessFrom(request.Context())
	return catalogservices.DescribeStoreActor(request.Context(), controller.Container, request, middlewares.AccountIdFrom(request.Context()), store.Role)
}

func (controller StoreSettingsController) GetSettings(writer http.ResponseWriter, request *http.Request) {
	view, err := getstoresettings.Handler{Container: controller.Container}.Execute(request.Context(), getstoresettings.Query{Store: middlewares.StoreAccessFrom(request.Context())})
	controller.respond(writer, request, view, err)
}

func (controller StoreSettingsController) PatchSettings(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.UpdateStoreSettingsRequest](writer, request, validators.ValidateUpdateStoreSettings)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	if body.Notifications != nil {
		current, loadError := controller.Container.Client.Store.Get(request.Context(), store.StoreId)
		if loadError != nil {
			controller.respond(writer, request, nil, loadError)
			return
		}
		if turnsOnAutomatedAlerts(services.NotificationPreferencesWithDefaults(current.NotificationPreferences), *body.Notifications) &&
			!sellerplans.Default.RequireFeature(writer, request, store.OwnerAccountId, "automated_alerts") {
			return
		}
	}
	view, err := updatestoresettings.Handler{Container: controller.Container}.Execute(request.Context(), updatestoresettings.Command{Store: store, Actor: controller.actorOf(request), Request: body})
	controller.respond(writer, request, view, err)
}

func turnsOnAutomatedAlerts(current, requested map[string]bool) bool {
	for key, value := range requested {
		if value && !current[key] && slices.Contains(dtos.AutomatedAlertKeys, key) {
			return true
		}
	}
	return false
}

func (controller StoreSettingsController) GetStorefront(writer http.ResponseWriter, request *http.Request) {
	view, err := getstorefront.Handler{Container: controller.Container}.Execute(request.Context(), getstorefront.Query{Store: middlewares.StoreAccessFrom(request.Context())})
	controller.respond(writer, request, view, err)
}

func (controller StoreSettingsController) PatchStorefront(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.UpdateStorefrontRequest](writer, request, validators.ValidateUpdateStorefront)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	command := updatestorefront.Command{Store: middlewares.StoreAccessFrom(request.Context()), Actor: controller.actorOf(request), Request: body}
	view, err := updatestorefront.Handler{Container: controller.Container}.Execute(request.Context(), command)
	controller.respond(writer, request, view, err)
}
