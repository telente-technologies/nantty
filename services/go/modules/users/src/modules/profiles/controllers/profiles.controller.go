package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	createprofileimageuploadintent "nantty/modules/users/src/modules/profiles/commands/createProfileImageUploadIntent"
	deactivateaccount "nantty/modules/users/src/modules/profiles/commands/deactivateAccount"
	updatecountrypreference "nantty/modules/users/src/modules/profiles/commands/updateCountryPreference"
	updateprofiledetails "nantty/modules/users/src/modules/profiles/commands/updateProfileDetails"
	"nantty/modules/users/src/modules/profiles/dtos"
	getmyprofile "nantty/modules/users/src/modules/profiles/queries/getMyProfile"
	getuserprofile "nantty/modules/users/src/modules/profiles/queries/getUserProfile"
	getuserprofilebyusername "nantty/modules/users/src/modules/profiles/queries/getUserProfileByUsername"
	"nantty/modules/users/src/modules/profiles/validators"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type ProfilesController struct {
	Container *container.Container
}

func (controller ProfilesController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func (controller ProfilesController) GetMyProfile(writer http.ResponseWriter, request *http.Request) {
	view, err := getmyprofile.Handler{Container: controller.Container}.Execute(request.Context(), getmyprofile.Query{AccountId: utils.AccountIdFromRequest(request)})
	controller.respondJson(writer, request, http.StatusOK, view, err)
}

func (controller ProfilesController) GetUserProfile(writer http.ResponseWriter, request *http.Request) {
	view, err := getuserprofile.Handler{Container: controller.Container}.Execute(request.Context(), getuserprofile.Query{AccountId: request.PathValue("userId")})
	controller.respondJson(writer, request, http.StatusOK, view, err)
}

func (controller ProfilesController) GetUserProfileByUsername(writer http.ResponseWriter, request *http.Request) {
	view, err := getuserprofilebyusername.Handler{Container: controller.Container}.Execute(request.Context(), getuserprofilebyusername.Query{Username: request.PathValue("username")})
	controller.respondJson(writer, request, http.StatusOK, view, err)
}

func (controller ProfilesController) UpdateMyProfile(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.UpdateProfileRequest](writer, request, validators.ValidateUpdateProfileRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := updateprofiledetails.Handler{Container: controller.Container}.Execute(request.Context(), updateprofiledetails.Command{
		AccountId: utils.AccountIdFromRequest(request), Name: body.Name, Bio: body.Bio,
		Website: updateprofiledetails.OptionalText(body.Website), AvatarUrl: updateprofiledetails.OptionalText(body.AvatarUrl), BannerUrl: updateprofiledetails.OptionalText(body.BannerUrl),
		AvatarMediaId: body.AvatarMediaId, BannerMediaId: body.BannerMediaId, IsPrivate: body.IsPrivate,
	})
	controller.respondJson(writer, request, http.StatusOK, view, err)
}

func (controller ProfilesController) CreateUploadIntent(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.UploadIntentRequest](writer, request, validators.ValidateUploadIntentRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	result, err := createprofileimageuploadintent.Handler{Container: controller.Container}.Execute(request.Context(), createprofileimageuploadintent.Command{
		AccountId: utils.AccountIdFromRequest(request), Purpose: body.Purpose, ContentType: body.ContentType, SizeBytes: body.SizeBytes,
	})
	controller.respondJson(writer, request, http.StatusCreated, result, err)
}

func (controller ProfilesController) UpdateCountryPreference(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.PreferencesRequest](writer, request, validators.ValidatePreferencesRequest)
	if err == nil {
		err = updatecountrypreference.Handler{Container: controller.Container}.Execute(request.Context(), updatecountrypreference.Command{AccountId: utils.AccountIdFromRequest(request), CountryCode: body.CountryCode, Theme: body.Theme})
	}
	controller.respondNoContent(writer, request, err)
}

func (controller ProfilesController) DeactivateAccount(writer http.ResponseWriter, request *http.Request) {
	err := deactivateaccount.Handler{Container: controller.Container}.Execute(request.Context(), deactivateaccount.Command{AccountId: utils.AccountIdFromRequest(request)})
	controller.respondNoContent(writer, request, err)
}

func (controller ProfilesController) respondJson(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller ProfilesController) respondNoContent(writer http.ResponseWriter, request *http.Request, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
