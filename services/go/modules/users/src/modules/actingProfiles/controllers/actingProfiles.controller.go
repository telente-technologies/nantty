package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	switchactingprofile "nantty/modules/users/src/modules/actingProfiles/commands/switchActingProfile"
	"nantty/modules/users/src/modules/actingProfiles/dtos"
	getactingprofile "nantty/modules/users/src/modules/actingProfiles/queries/getActingProfile"
	listmyprofiles "nantty/modules/users/src/modules/actingProfiles/queries/listMyProfiles"
	"nantty/modules/users/src/modules/actingProfiles/validators"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type ActingProfilesController struct {
	Container *container.Container
}

func (controller ActingProfilesController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}

func (controller ActingProfilesController) ListMyProfiles(writer http.ResponseWriter, request *http.Request) {
	page, err := listmyprofiles.Handler{Container: controller.Container}.Execute(request.Context(), listmyprofiles.Query{AccountId: utils.AccountIdFromRequest(request)})
	controller.respond(writer, request, page, err)
}

func (controller ActingProfilesController) GetActingProfile(writer http.ResponseWriter, request *http.Request) {
	view, err := getactingprofile.Handler{Container: controller.Container}.Execute(request.Context(), getactingprofile.Query{AccountId: utils.AccountIdFromRequest(request)})
	controller.respond(writer, request, view, err)
}

func (controller ActingProfilesController) SwitchActingProfile(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.SwitchActingProfileRequest](writer, request, validators.ValidateSwitchActingProfileRequest)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	view, err := switchactingprofile.Handler{Container: controller.Container}.Execute(request.Context(), switchactingprofile.Command{AccountId: utils.AccountIdFromRequest(request), ProfileId: body.ProfileId})
	controller.respond(writer, request, view, err)
}
