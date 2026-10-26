package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	consentmodels "nantty/modules/users/src/modules/consents/models"
	updatemyprivacysettings "nantty/modules/users/src/modules/privacySettings/commands/updateMyPrivacySettings"
	"nantty/modules/users/src/modules/privacySettings/dtos"
	getprivacysettings "nantty/modules/users/src/modules/privacySettings/queries/getPrivacySettings"
	"nantty/modules/users/src/modules/privacySettings/validators"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type PrivacySettingsController struct {
	Container *container.Container
}

func (controller PrivacySettingsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func (controller PrivacySettingsController) GetMine(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	settings, err := getprivacysettings.Handler{Container: controller.Container}.Execute(request.Context(), getprivacysettings.Query{AccountId: accountId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.ConvertSettingsToResponse(settings))
}

func (controller PrivacySettingsController) UpdateMine(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, func(body dtos.UpdatePrivacySettingsRequest) error {
		return validators.ValidateUpdatePrivacySettingsRequest(body)
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	command := updatemyprivacysettings.Command{
		AccountId: accountId, Personalization: body.Personalization, PersonalizedAds: body.PersonalizedAds, Marketing: body.Marketing, Analytics: body.Analytics,
		Metadata: consentmodels.RequestMetadata{IpAddress: utils.ClientIpAddress(request), UserAgent: utils.TruncateTo(request.UserAgent(), 255), Source: "privacy_settings"},
	}
	if body.PolicyVersion != nil {
		command.PolicyVersion = *body.PolicyVersion
	}
	settings, err := updatemyprivacysettings.Handler{Container: controller.Container}.Execute(request.Context(), command)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.ConvertSettingsToResponse(settings))
}

func (controller PrivacySettingsController) GetForInternalCaller(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	if !utils.SecretsMatch(expected, request.Header.Get("X-Internal-Token")) {
		controller.fail(writer, request, httpserver.ErrUnauthorized)
		return
	}
	accountId, err := utils.ParseUuidPathValue(request, "accountId")
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	settings, err := getprivacysettings.Handler{Container: controller.Container}.Execute(request.Context(), getprivacysettings.Query{AccountId: accountId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.ConvertSettingsToResponse(settings))
}
