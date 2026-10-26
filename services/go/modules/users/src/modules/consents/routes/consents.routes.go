package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/consents/controllers"
	"nantty/modules/users/src/utils"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

func MountConsentsRoutes(mux *http.ServeMux, c *container.Container) {
	controller := controllers.ConsentsController{Container: c, Limiter: utils.NewIpRateLimiter(c.Settings.Privacy.AnonymousConsentPerMinute, c.Now)}
	requireAccount := jwtauth.RequireVerifiedAccessToken(c.AccessVerifier)
	requireStaff := staffauth.Guard{Registry: identityports.Default}
	mux.HandleFunc("GET /api/v1/policies/current", controller.ListCurrentPolicies)
	mux.HandleFunc("GET /api/v1/consents", controller.GetAnonymousConsents)
	mux.HandleFunc("PUT /api/v1/consents", controller.SetAnonymousConsents)
	mux.Handle("GET /api/v1/users/me/consents", requireAccount(http.HandlerFunc(controller.GetMyConsents)))
	mux.Handle("PUT /api/v1/users/me/consents", requireAccount(http.HandlerFunc(controller.SetMyConsents)))
	mux.Handle("POST /api/v1/users/me/consents/merge", requireAccount(http.HandlerFunc(controller.MergeDeviceConsents)))
	mux.Handle("POST /api/v1/users/me/terms-acceptances", requireAccount(http.HandlerFunc(controller.AcceptTerms)))
	mux.Handle("GET /api/v1/users/me/terms-acceptances", requireAccount(http.HandlerFunc(controller.ListTermsAcceptances)))
	mux.Handle("POST /api/v1/admin/policy-versions", requireStaff.RequireStaff("privacy.policies.write", true)(http.HandlerFunc(controller.PublishPolicyVersion)))
}
