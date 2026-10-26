package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	updatemarketingpreferences "nantty/modules/users/src/modules/accountSettings/commands/updateMarketingPreferences"
	updatemysettings "nantty/modules/users/src/modules/accountSettings/commands/updateMySettings"
	"nantty/modules/users/src/modules/accountSettings/dtos"
	getmarketingpreferences "nantty/modules/users/src/modules/accountSettings/queries/getMarketingPreferences"
	getmysettings "nantty/modules/users/src/modules/accountSettings/queries/getMySettings"
	"nantty/modules/users/src/modules/accountSettings/validators"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type AccountSettingsController struct {
	Container *container.Container
}

func (controller AccountSettingsController) GetMySettings(writer http.ResponseWriter, request *http.Request) {
	settings, err := getmysettings.Handler{Container: controller.Container}.Execute(request.Context(), getmysettings.Query{AccountId: utils.AccountIdFromRequest(request)})
	controller.respond(writer, request, settings, err)
}

func (controller AccountSettingsController) UpdateMySettings(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.UpdateSettingsRequest](writer, request, validators.ValidateUpdateSettingsRequest)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	accountId := utils.AccountIdFromRequest(request)
	err = updatemysettings.Handler{Container: controller.Container}.Execute(request.Context(), updatemysettings.Command{
		AccountId: accountId, Email: body.Email, Theme: body.Theme, Language: body.Language, CountryCode: body.CountryCode,
		PushNotificationsEnabled: body.PushNotificationsEnabled, TwoFactorEnabled: body.TwoFactorEnabled,
	})
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	controller.GetMySettings(writer, request)
}

func (controller AccountSettingsController) GetMarketingPreferences(writer http.ResponseWriter, request *http.Request) {
	preferences, err := getmarketingpreferences.Handler{Container: controller.Container}.Execute(request.Context(), getmarketingpreferences.Query{AccountId: utils.AccountIdFromRequest(request)})
	controller.respond(writer, request, preferences, err)
}

func (controller AccountSettingsController) UpdateMarketingPreferences(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.MarketingPreferencesRequest](writer, request, validators.ValidateMarketingPreferencesRequest)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	preferences, err := updatemarketingpreferences.Handler{Container: controller.Container}.Execute(request.Context(), updatemarketingpreferences.Command{
		AccountId: utils.AccountIdFromRequest(request), Frequency: body.Frequency,
	})
	controller.respond(writer, request, preferences, err)
}

func (controller AccountSettingsController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}
