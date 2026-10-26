package routes

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/staffAccount/controllers"
)

func MountStaffAccountRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.StaffAccountController{Container: container}
	anyStaff := container.Guard.RequireStaff("", false)
	anyStaffWithStepUp := container.Guard.RequireStaff("", true)
	mux.Handle("GET /api/v1/admin/account", anyStaff(http.HandlerFunc(controller.Describe)))
	mux.Handle("GET /api/v1/admin/account/sessions", anyStaff(http.HandlerFunc(controller.ListSessions)))
	mux.Handle("POST /api/v1/admin/account/sessions/{sessionId}/revoke", anyStaff(http.HandlerFunc(controller.RevokeSession)))
	mux.Handle("POST /api/v1/admin/account/recovery-codes/regenerate", anyStaffWithStepUp(http.HandlerFunc(controller.RegenerateRecoveryCodes)))
	mux.Handle("POST /api/v1/admin/account/passkeys/options", anyStaffWithStepUp(http.HandlerFunc(controller.PasskeyOptions)))
	mux.Handle("POST /api/v1/admin/account/passkeys", anyStaffWithStepUp(http.HandlerFunc(controller.AddPasskey)))
	mux.Handle("DELETE /api/v1/admin/account/passkeys/{passkeyId}", anyStaffWithStepUp(http.HandlerFunc(controller.RemovePasskey)))
	mux.Handle("POST /api/v1/admin/consents", anyStaff(http.HandlerFunc(controller.RecordConsent)))
}
