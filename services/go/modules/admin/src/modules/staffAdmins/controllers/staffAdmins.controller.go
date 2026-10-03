package controllers

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	changeadminpermissions "zudomart/modules/admin/src/modules/staffAdmins/commands/changeAdminPermissions"
	disableadmin "zudomart/modules/admin/src/modules/staffAdmins/commands/disableAdmin"
	inviteadmin "zudomart/modules/admin/src/modules/staffAdmins/commands/inviteAdmin"
	liststaff "zudomart/modules/admin/src/modules/staffAdmins/queries/listStaff"
	"zudomart/modules/admin/src/modules/staffAdmins/validators"
	httprequests "zudomart/modules/admin/src/utils/httpRequests"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type StaffAdminsController struct {
	Container *container.Container
}

func (controller StaffAdminsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
}

func (controller StaffAdminsController) List(writer http.ResponseWriter, request *http.Request) {
	result, err := liststaff.Handler{Container: controller.Container}.Execute(request.Context(), liststaff.Query{Cursor: request.URL.Query().Get("cursor")})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller StaffAdminsController) Invite(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateInviteStaffRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := inviteadmin.Handler{Container: controller.Container}.Execute(request.Context(), inviteadmin.Command{
		Actor: actor, Email: body.Email, DisplayName: body.DisplayName, Permissions: body.Permissions,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, result)
}

func (controller StaffAdminsController) ChangePermissions(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateChangePermissionsRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := changeadminpermissions.Handler{Container: controller.Container}.Execute(request.Context(), changeadminpermissions.Command{
		Actor: actor, TargetId: request.PathValue("staffId"), Permissions: body.Permissions,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller StaffAdminsController) Disable(writer http.ResponseWriter, request *http.Request) {
	actor, _ := staffauth.StaffFromContext(request.Context())
	err := disableadmin.Handler{Container: controller.Container}.Execute(request.Context(), disableadmin.Command{Actor: actor, TargetId: request.PathValue("staffId")})
	httprequests.RespondNoContentOrError(writer, request, controller.Container.Logger, err)
}
