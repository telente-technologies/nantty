package controllers

import (
	"net/http"

	"zudomart/modules/users/src/container"
	createcreatorprofile "zudomart/modules/users/src/modules/creatorProfiles/commands/createCreatorProfile"
	"zudomart/modules/users/src/modules/creatorProfiles/dtos"
	"zudomart/modules/users/src/modules/creatorProfiles/validators"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/httpserver"
)

type CreatorProfilesController struct {
	Container *container.Container
}

func (controller CreatorProfilesController) CreateCreatorProfile(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.CreateCreatorProfileRequest](writer, request, validators.ValidateCreateCreatorProfileRequest)
	if err == nil {
		var view any
		view, err = createcreatorprofile.Handler{Container: controller.Container}.Execute(request.Context(), createcreatorprofile.Command{
			AccountId: utils.AccountIdFromRequest(request), DisplayName: body.DisplayName, Handle: body.Handle, Bio: body.Bio,
		})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
			return
		}
	}
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}
