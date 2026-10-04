package controllers

import (
	"net/http"

	updateplatformsetting "zudomart/modules/admin/src/modules/platformSettings/commands/updatePlatformSetting"
	getplatformsetting "zudomart/modules/admin/src/modules/platformSettings/queries/getPlatformSetting"
	"zudomart/modules/admin/src/modules/platformSettings/services"
	"zudomart/modules/admin/src/modules/platformSettings/validators"
	httprequests "zudomart/modules/admin/src/utils/httpRequests"
	"zudomart/platform/staffauth"
)

func (controller PlatformSettingsController) GetTrendingModeration(writer http.ResponseWriter, request *http.Request) {
	result, err := getplatformsetting.Handler{Container: controller.Container}.Execute(request.Context(), getplatformsetting.Query{Key: services.TrendingModerationKey})
	controller.respond(writer, request, result, err)
}

func (controller PlatformSettingsController) UpdateTrendingModeration(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateUpdateSettingRequest)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := updateplatformsetting.Handler{Container: controller.Container}.Execute(request.Context(), updateplatformsetting.Command{
		Actor: actor, Key: services.TrendingModerationKey, Value: body.EffectiveValue(), ExpectedVersion: body.ExpectedVersion, Reason: body.Reason,
	})
	controller.respond(writer, request, result, err)
}
