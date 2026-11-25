package developerproduction

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type Controller struct {
	Container *container.Container
}

func Mount(mux *http.ServeMux, deployed *container.Container) {
	controller := Controller{Container: deployed}
	requireAccess := jwtauth.RequireVerifiedAccessToken(deployed.AccessVerifier)
	rateLimit := httpserver.RateLimitEveryRequest(false)

	appBase := "/api/v1/developer/organizations/{organizationID}/applications/{applicationID}"
	mux.Handle("GET "+appBase+"/credentials", rateLimit(requireAccess(http.HandlerFunc(controller.ListCredentials))))
	mux.Handle("POST "+appBase+"/credentials", rateLimit(requireAccess(http.HandlerFunc(controller.CreateCredential))))
	mux.Handle("POST "+appBase+"/credentials/{credentialID}/rotate", rateLimit(requireAccess(http.HandlerFunc(controller.RotateCredential))))
	mux.Handle("DELETE "+appBase+"/credentials/{credentialID}", rateLimit(requireAccess(http.HandlerFunc(controller.RevokeCredential))))

	mux.Handle("GET "+appBase+"/webhooks", rateLimit(requireAccess(http.HandlerFunc(controller.ListWebhooks))))
	mux.Handle("POST "+appBase+"/webhooks", rateLimit(requireAccess(http.HandlerFunc(controller.CreateWebhook))))
	mux.Handle("POST "+appBase+"/webhooks/{webhookID}/verify", rateLimit(requireAccess(http.HandlerFunc(controller.VerifyWebhook))))
	mux.Handle("POST "+appBase+"/webhooks/{webhookID}/rotate-secret", rateLimit(requireAccess(http.HandlerFunc(controller.RotateWebhookSecret))))
	mux.Handle("DELETE "+appBase+"/webhooks/{webhookID}", rateLimit(requireAccess(http.HandlerFunc(controller.DeleteWebhook))))

	mux.Handle("GET "+appBase+"/requests", rateLimit(requireAccess(http.HandlerFunc(controller.ListRequests))))
	mux.Handle("GET "+appBase+"/usage", rateLimit(requireAccess(http.HandlerFunc(controller.GetUsage))))

	orgBase := "/api/v1/developer/organizations/{organizationID}"
	mux.Handle("GET "+orgBase+"/billing", rateLimit(requireAccess(http.HandlerFunc(controller.GetBilling))))
	mux.Handle("POST "+orgBase+"/billing/checkout", rateLimit(requireAccess(http.HandlerFunc(controller.CheckoutBilling))))

	mux.Handle("POST /api/v1/business/messages", rateLimit(http.HandlerFunc(controller.BusinessMessagingUnavailable)))
	mux.Handle("GET /api/v1/business/conversations", rateLimit(http.HandlerFunc(controller.ListBusinessConversations)))
	mux.Handle("GET /api/v1/business/conversations/{recipientId}/messages", rateLimit(http.HandlerFunc(controller.ListBusinessMessages)))
	mux.Handle("GET /api/v1/business/messages/{messageId}", rateLimit(http.HandlerFunc(controller.GetBusinessMessageStatus)))
}

func (controller Controller) BusinessMessagingUnavailable(writer http.ResponseWriter, request *http.Request) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusServiceUnavailable, "BUSINESS_MESSAGING_UNAVAILABLE", "Business messaging is not available yet."))
}

func (controller Controller) store() Store { return Store{Container: controller.Container} }

func (controller Controller) ListCredentials(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, appUUID, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "credentials.manage", false)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	rows, err := controller.Container.Database.QueryContext(request.Context(),
		`SELECT id::text, name, prefix, scopes, status, created_at, last_used_at
		 FROM developer_production_credentials WHERE organization_id = $1 AND application_id = $2 ORDER BY created_at DESC`,
		orgUUID, appUUID,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer rows.Close()
	items := []CredentialView{}
	for rows.Next() {
		var v CredentialView
		var scopesRaw []byte
		var lastUsed sql.NullTime
		if err := rows.Scan(&v.Id, &v.Name, &v.Prefix, &scopesRaw, &v.Status, &v.CreatedAt, &lastUsed); err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		_ = json.Unmarshal(scopesRaw, &v.Scopes)
		if lastUsed.Valid {
			v.LastUsedAt = &lastUsed.Time
		}
		items = append(items, v)
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"credentials": items})
}

func (controller Controller) CreateCredential(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, appUUID, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "credentials.manage", true)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var body struct {
		Name   string   `json:"name"`
		Scopes []string `json:"scopes"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if strings.TrimSpace(body.Name) == "" || len(body.Scopes) == 0 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CREDENTIAL", "Name and non-empty scopes are required."))
		return
	}
	cred, secret, err := controller.store().CreateCredential(request.Context(), orgUUID, appUUID, principal.UserId, strings.TrimSpace(body.Name), body.Scopes)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, map[string]any{"credential": cred, "secret": secret})
}

func (controller Controller) RevokeCredential(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, appUUID, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "credentials.manage", false)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	credId, err := uuid.Parse(request.PathValue("credentialID"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CREDENTIAL_ID", "Invalid credential ID."))
		return
	}
	_, err = controller.Container.Database.ExecContext(request.Context(),
		`UPDATE developer_production_credentials SET status = 'revoked', revoked_at = $1 WHERE id = $2 AND organization_id = $3 AND application_id = $4`,
		controller.Container.Now().UTC(), credId, orgUUID, appUUID,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller Controller) RotateCredential(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, appUUID, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "credentials.manage", true)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	credentialID, err := uuid.Parse(request.PathValue("credentialID"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CREDENTIAL_ID", "Invalid credential ID."))
		return
	}
	credential, secret, err := controller.store().RotateCredential(request.Context(), orgUUID, appUUID, credentialID, principal.UserId)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"credential": credential, "secret": secret})
}

func (controller Controller) ListWebhooks(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, appUUID, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "webhooks.manage", false)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	rows, err := controller.Container.Database.QueryContext(request.Context(),
		`SELECT id::text, url, events, active, signing_secret_preview, verified_at, created_at FROM developer_production_webhooks WHERE organization_id = $1 AND application_id = $2 ORDER BY created_at DESC`,
		orgUUID, appUUID,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer rows.Close()
	items := []WebhookView{}
	for rows.Next() {
		var v WebhookView
		var eventsRaw []byte
		var verifiedAt sql.NullTime
		if err := rows.Scan(&v.Id, &v.Url, &eventsRaw, &v.Active, &v.SigningSecretPreview, &verifiedAt, &v.CreatedAt); err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		_ = json.Unmarshal(eventsRaw, &v.Events)
		if verifiedAt.Valid {
			v.VerifiedAt = &verifiedAt.Time
		}
		items = append(items, v)
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"webhooks": items})
}

func (controller Controller) CreateWebhook(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, appUUID, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "webhooks.manage", true)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var body struct {
		Url    string   `json:"url"`
		Events []string `json:"events"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if len(body.Events) == 0 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_WEBHOOK", "At least one event is required."))
		return
	}
	wh, secret, err := controller.store().CreateWebhook(request.Context(), orgUUID, appUUID, body.Url, body.Events)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, map[string]any{"webhook": wh, "signingSecret": secret})
}

func (controller Controller) DeleteWebhook(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, appUUID, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "webhooks.manage", false)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	whId, err := uuid.Parse(request.PathValue("webhookID"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_WEBHOOK_ID", "Invalid webhook ID."))
		return
	}
	_, err = controller.Container.Database.ExecContext(request.Context(),
		`DELETE FROM developer_production_webhooks WHERE id = $1 AND organization_id = $2 AND application_id = $3`, whId, orgUUID, appUUID,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
