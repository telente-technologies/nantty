package routes

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/staffAuth/controllers"
)

func MountStaffAuthRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.StaffAuthController{Container: container}
	requireStaff := container.Guard.RequireStaff("", false)
	mux.HandleFunc("POST /api/v1/admin/auth/login", controller.LogIn)
	mux.HandleFunc("POST /api/v1/admin/auth/mfa/enroll/start", controller.StartTotpEnrollment)
	mux.HandleFunc("POST /api/v1/admin/auth/mfa/enroll/confirm", controller.ConfirmTotpEnrollment)
	mux.HandleFunc("POST /api/v1/admin/auth/mfa/verify", controller.VerifyMfa)
	mux.HandleFunc("POST /api/v1/admin/auth/refresh", controller.Refresh)
	mux.HandleFunc("POST /api/v1/admin/auth/accept-invitation", controller.AcceptInvitation)
	mux.Handle("POST /api/v1/admin/auth/logout", requireStaff(http.HandlerFunc(controller.LogOut)))
	mux.Handle("GET /api/v1/admin/auth/me", requireStaff(http.HandlerFunc(controller.Me)))
	mux.Handle("POST /api/v1/admin/auth/step-up", requireStaff(http.HandlerFunc(controller.StepUp)))
	mux.HandleFunc("POST /api/v1/admin/auth/mfa/webauthn/options", controller.PasskeySignInOptions)
	mux.Handle("POST /api/v1/admin/auth/step-up/webauthn/options", requireStaff(http.HandlerFunc(controller.PasskeyStepUpOptions)))
	mux.Handle("PATCH /api/v1/admin/auth/me/preferences", requireStaff(http.HandlerFunc(controller.UpdatePreferences)))
	mux.Handle("PATCH /api/v1/admin/users/me/preferences", requireStaff(http.HandlerFunc(controller.UpdatePreferences)))
}
