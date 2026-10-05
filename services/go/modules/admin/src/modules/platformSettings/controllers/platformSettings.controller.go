package controllers

import (
	"crypto/subtle"
	"net/http"
	"strconv"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	updateplatformsetting "zudomart/modules/admin/src/modules/platformSettings/commands/updatePlatformSetting"
	getplatformsetting "zudomart/modules/admin/src/modules/platformSettings/queries/getPlatformSetting"
	listplatformsettings "zudomart/modules/admin/src/modules/platformSettings/queries/listPlatformSettings"
	listsettingversions "zudomart/modules/admin/src/modules/platformSettings/queries/listSettingVersions"
	readpublicplatformsetting "zudomart/modules/admin/src/modules/platformSettings/queries/readPublicPlatformSetting"
	"zudomart/modules/admin/src/modules/platformSettings/validators"
	httprequests "zudomart/modules/admin/src/utils/httpRequests"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type PlatformSettingsController struct {
	Container *container.Container
}

func (controller PlatformSettingsController) respond(writer http.ResponseWriter, request *http.Request, result any, err error) {
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller PlatformSettingsController) List(writer http.ResponseWriter, request *http.Request) {
	result, err := listplatformsettings.Handler{Container: controller.Container}.Execute(request.Context(), listplatformsettings.Query{})
	controller.respond(writer, request, map[string]any{"data": result, "nextCursor": nil}, err)
}

func (controller PlatformSettingsController) Get(writer http.ResponseWriter, request *http.Request) {
	result, err := getplatformsetting.Handler{Container: controller.Container}.Execute(request.Context(), getplatformsetting.Query{Key: request.PathValue("key")})
	controller.respond(writer, request, result, err)
}

func (controller PlatformSettingsController) Update(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateUpdateSettingRequest)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := updateplatformsetting.Handler{Container: controller.Container}.Execute(request.Context(), updateplatformsetting.Command{
		Actor: actor, Key: request.PathValue("key"), Value: body.EffectiveValue(), ExpectedVersion: body.ExpectedVersion, Reason: body.Reason,
	})
	controller.respond(writer, request, result, err)
}

func (controller PlatformSettingsController) ListVersions(writer http.ResponseWriter, request *http.Request) {
	result, err := listsettingversions.Handler{Container: controller.Container}.Execute(request.Context(), listsettingversions.Query{Key: request.PathValue("key"), Cursor: request.URL.Query().Get("cursor")})
	controller.respond(writer, request, result, err)
}

func (controller PlatformSettingsController) RestoreVersion(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateRestoreSettingRequest)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	version, err := strconv.Atoi(request.PathValue("version"))
	if err != nil || version < 1 {
		controller.respond(writer, request, nil, adminerrors.VersionNotFound)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := updateplatformsetting.Handler{Container: controller.Container}.Execute(request.Context(), updateplatformsetting.Command{
		Actor: actor, Key: request.PathValue("key"), ExpectedVersion: body.ExpectedVersion, Reason: body.Reason, RestoreVersion: version,
	})
	controller.respond(writer, request, result, err)
}

func (controller PlatformSettingsController) PublicCreatorRequirements(writer http.ResponseWriter, request *http.Request) {
	result, err := readpublicplatformsetting.Handler{Container: controller.Container}.Execute(request.Context(), readpublicplatformsetting.Query{Key: "creator.requirements"})
	controller.respond(writer, request, result, err)
}

func (controller PlatformSettingsController) InternalRead(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.InternalApiToken
	presented := request.Header.Get("X-Internal-Token")
	if expected == "" {
		controller.respond(writer, request, nil, httpserver.ErrNotFound)
		return
	}
	if subtle.ConstantTimeCompare([]byte(expected), []byte(presented)) != 1 {
		controller.respond(writer, request, nil, httpserver.ErrUnauthorized)
		return
	}
	result, err := getplatformsetting.Handler{Container: controller.Container}.Execute(request.Context(), getplatformsetting.Query{Key: request.PathValue("key")})
	controller.respond(writer, request, result, err)
}
