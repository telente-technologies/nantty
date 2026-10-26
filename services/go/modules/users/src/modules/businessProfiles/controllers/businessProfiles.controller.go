package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	createbusinessprofile "nantty/modules/users/src/modules/businessProfiles/commands/createBusinessProfile"
	updatebusinessprofile "nantty/modules/users/src/modules/businessProfiles/commands/updateBusinessProfile"
	"nantty/modules/users/src/modules/businessProfiles/dtos"
	listbusinesscategories "nantty/modules/users/src/modules/businessProfiles/queries/listBusinessCategories"
	"nantty/modules/users/src/modules/businessProfiles/validators"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type BusinessProfilesController struct {
	Container *container.Container
}

func (controller BusinessProfilesController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller BusinessProfilesController) CreateBusinessProfile(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.CreateBusinessProfileRequest](writer, request, validators.ValidateCreateBusinessProfileRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	selections := make([]createbusinessprofile.CategorySelection, 0, len(body.Categories))
	for _, selection := range body.Categories {
		selections = append(selections, createbusinessprofile.CategorySelection(selection))
	}
	view, err := createbusinessprofile.Handler{Container: controller.Container}.Execute(request.Context(), createbusinessprofile.Command{
		AccountId: utils.AccountIdFromRequest(request), DisplayName: body.DisplayName, Handle: body.Handle, Description: body.Description, Website: body.Website, BusinessType: body.BusinessType, Purpose: body.Purpose, Categories: selections,
	})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller BusinessProfilesController) UpdateBusinessProfile(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.UpdateBusinessProfileRequest](writer, request, validators.ValidateUpdateBusinessProfileRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := updatebusinessprofile.Handler{Container: controller.Container}.Execute(request.Context(), updatebusinessprofile.Command{
		AccountId: utils.AccountIdFromRequest(request), ProfileId: request.PathValue("profileId"), DisplayName: body.DisplayName, Description: body.Description,
		Website: body.Website.Value, ClearSite: body.Website.Present && body.Website.Value == nil, IsPrivate: body.IsPrivate,
	})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller BusinessProfilesController) ListBusinessCategories(writer http.ResponseWriter, request *http.Request) {
	page, err := listbusinesscategories.Handler{Container: controller.Container}.Execute(request.Context(), listbusinesscategories.Query{Cursor: request.URL.Query().Get("cursor")})
	controller.respond(writer, request, http.StatusOK, page, err)
}
