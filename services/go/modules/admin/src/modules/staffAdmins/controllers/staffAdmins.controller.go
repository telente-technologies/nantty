package controllers

import (
	"crypto/subtle"
	"net/http"

	"github.com/google/uuid"

	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"

	"nantty/modules/admin/src/container"
	approvesuperadmin "nantty/modules/admin/src/modules/staffAdmins/commands/approveSuperadmin"
	changeadminipallowlist "nantty/modules/admin/src/modules/staffAdmins/commands/changeAdminIpAllowList"
	changeadminpermissions "nantty/modules/admin/src/modules/staffAdmins/commands/changeAdminPermissions"
	createadmin "nantty/modules/admin/src/modules/staffAdmins/commands/createAdmin"
	createstaffrole "nantty/modules/admin/src/modules/staffAdmins/commands/createStaffRole"
	disableadmin "nantty/modules/admin/src/modules/staffAdmins/commands/disableAdmin"
	enableadmin "nantty/modules/admin/src/modules/staffAdmins/commands/enableAdmin"
	resetadminmfa "nantty/modules/admin/src/modules/staffAdmins/commands/resetAdminMfa"
	revokeadminaccess "nantty/modules/admin/src/modules/staffAdmins/commands/revokeAdminAccess"
	suspendadminaccess "nantty/modules/admin/src/modules/staffAdmins/commands/suspendAdminAccess"
	updatestaffsettings "nantty/modules/admin/src/modules/staffAdmins/commands/updateStaffSettings"
	"nantty/modules/admin/src/modules/staffAdmins/dtos"
	getstaffdetail "nantty/modules/admin/src/modules/staffAdmins/queries/getStaffDetail"
	getstaffsettings "nantty/modules/admin/src/modules/staffAdmins/queries/getStaffSettings"
	liststaff "nantty/modules/admin/src/modules/staffAdmins/queries/listStaff"
	liststaffroles "nantty/modules/admin/src/modules/staffAdmins/queries/listStaffRoles"
	"nantty/modules/admin/src/modules/staffAdmins/validators"
	httprequests "nantty/modules/admin/src/utils/httpRequests"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

type StaffAdminsController struct {
	Container *container.Container
}

func (controller StaffAdminsController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller StaffAdminsController) List(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := liststaff.Handler{Container: controller.Container}.Execute(request.Context(), liststaff.Query{
		Cursor: query.Get("cursor"), Search: query.Get("search"), Status: query.Get("status"), Role: query.Get("role"),
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAdminsController) Detail(writer http.ResponseWriter, request *http.Request) {
	result, err := getstaffdetail.Handler{Container: controller.Container}.Execute(request.Context(), getstaffdetail.Query{TargetId: request.PathValue("staffId")})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAdminsController) Create(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateCreateAdminRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := createadmin.Handler{Container: controller.Container}.Execute(request.Context(), createadmin.Command{
		Actor: actor, Email: body.Email, Name: body.Name, Role: body.Role, RoleIds: body.RoleIds, Permissions: body.Permissions, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller StaffAdminsController) ChangePermissions(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateChangePermissionsRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := changeadminpermissions.Handler{Container: controller.Container}.Execute(request.Context(), changeadminpermissions.Command{
		Actor: actor, TargetId: request.PathValue("staffId"), Role: body.Role, RoleIds: body.RoleIds, Permissions: body.Permissions, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, map[string]any{"admin": result}, err)
}

func (controller StaffAdminsController) Update(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateUpdateAdminRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := changeadminipallowlist.Handler{Container: controller.Container}.Execute(request.Context(), changeadminipallowlist.Command{
		Actor: actor, TargetId: request.PathValue("staffId"), IpAllowList: *body.IpAllowList, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, map[string]any{"admin": result}, err)
}

func (controller StaffAdminsController) changeAccess(writer http.ResponseWriter, request *http.Request, execute func(actor staffauth.Staff, targetId, reason string) (any, error)) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateReasonRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := execute(actor, request.PathValue("staffId"), body.Reason)
	controller.respond(writer, request, http.StatusOK, map[string]any{"admin": result}, err)
}

func (controller StaffAdminsController) Disable(writer http.ResponseWriter, request *http.Request) {
	controller.changeAccess(writer, request, func(actor staffauth.Staff, targetId, reason string) (any, error) {
		return disableadmin.Handler{Container: controller.Container}.Execute(request.Context(), disableadmin.Command{Actor: actor, TargetId: targetId, Reason: reason})
	})
}

func (controller StaffAdminsController) Enable(writer http.ResponseWriter, request *http.Request) {
	controller.changeAccess(writer, request, func(actor staffauth.Staff, targetId, reason string) (any, error) {
		return enableadmin.Handler{Container: controller.Container}.Execute(request.Context(), enableadmin.Command{Actor: actor, TargetId: targetId, Reason: reason})
	})
}

func (controller StaffAdminsController) Suspend(writer http.ResponseWriter, request *http.Request) {
	controller.changeAccess(writer, request, func(actor staffauth.Staff, targetId, reason string) (any, error) {
		return suspendadminaccess.Handler{Container: controller.Container}.Execute(request.Context(), suspendadminaccess.Command{Actor: actor, TargetId: targetId, Reason: reason})
	})
}

func (controller StaffAdminsController) Revoke(writer http.ResponseWriter, request *http.Request) {
	controller.changeAccess(writer, request, func(actor staffauth.Staff, targetId, reason string) (any, error) {
		return revokeadminaccess.Handler{Container: controller.Container}.Execute(request.Context(), revokeadminaccess.Command{Actor: actor, TargetId: targetId, Reason: reason})
	})
}

func (controller StaffAdminsController) ResetMfa(writer http.ResponseWriter, request *http.Request) {
	controller.changeAccess(writer, request, func(actor staffauth.Staff, targetId, reason string) (any, error) {
		return resetadminmfa.Handler{Container: controller.Container}.Execute(request.Context(), resetadminmfa.Command{Actor: actor, TargetId: targetId, Reason: reason})
	})
}

func (controller StaffAdminsController) ApproveSuperadmin(writer http.ResponseWriter, request *http.Request) {
	controller.changeAccess(writer, request, func(actor staffauth.Staff, targetId, reason string) (any, error) {
		return approvesuperadmin.Handler{Container: controller.Container}.Execute(request.Context(), approvesuperadmin.Command{Actor: actor, TargetId: targetId, Reason: reason})
	})
}

func (controller StaffAdminsController) ListRoles(writer http.ResponseWriter, request *http.Request) {
	result, err := liststaffroles.Handler{Container: controller.Container}.Execute(request.Context(), liststaffroles.Query{})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAdminsController) CreateRole(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateCreateRoleRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := createstaffrole.Handler{Container: controller.Container}.Execute(request.Context(), createstaffrole.Command{Actor: actor, Name: body.Name, Permissions: body.Permissions, Reason: body.Reason})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller StaffAdminsController) GetSettings(writer http.ResponseWriter, request *http.Request) {
	result, err := getstaffsettings.Handler{Container: controller.Container}.Execute(request.Context(), getstaffsettings.Query{})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAdminsController) UpdateSettings(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate[dtos.UpdateStaffSettingsRequest](writer, request, validators.ValidateUpdateStaffSettingsRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	result, err := updatestaffsettings.Handler{Container: controller.Container}.Execute(request.Context(), updatestaffsettings.Command{Actor: actor, RequireSecondSuperadminApproval: *body.RequireSecondSuperadminApproval, Reason: body.Reason})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAdminsController) NotificationRecipient(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	staffId, err := uuid.Parse(request.PathValue("staffId"))
	if err != nil {
		controller.respond(writer, request, 0, nil, adminerrors.StaffNotFound)
		return
	}
	row, err := controller.Container.Client.StaffAccount.Get(request.Context(), staffId)
	if ent.IsNotFound(err) {
		err = adminerrors.StaffNotFound
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.respond(writer, request, http.StatusOK, map[string]any{"email": row.Email, "name": row.DisplayName, "status": row.Status}, nil)
}
