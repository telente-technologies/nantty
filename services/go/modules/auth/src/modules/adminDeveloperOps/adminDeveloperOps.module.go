package admindeveloperops

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	"nantty/platform/httpserver"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

type Controller struct {
	Container *container.Container
}

func Mount(mux *http.ServeMux, deployed *container.Container) {
	controller := Controller{Container: deployed}
	staffVerifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(
		deployed.Keys.PublishedPublicKeySet,
		deployed.Settings.TokenIssuer,
		staffauth.AccessAudience,
	)
	guard := staffauth.Guard{Registry: identityports.Default}
	requireStaff := jwtauth.RequireVerifiedAccessToken(staffVerifier)
	canReview := guard.RequireStaff("applications:sellers", false)
	canApprove := guard.RequireStaff("applications:sellers", true)
	canManagePlans := guard.RequireStaff("config:plans", true)

	mux.Handle("GET /api/v1/admin/developer/applications", requireStaff(canReview(http.HandlerFunc(controller.ListApplications))))
	mux.Handle("POST /api/v1/admin/developer/applications/{applicationID}/review", requireStaff(canApprove(http.HandlerFunc(controller.ReviewApplication))))
	mux.Handle("PATCH /api/v1/admin/developer/organizations/{organizationID}/quota", requireStaff(canManagePlans(http.HandlerFunc(controller.UpdateQuota))))
}

func (controller Controller) ListApplications(writer http.ResponseWriter, request *http.Request) {
	statusFilter := strings.TrimSpace(request.URL.Query().Get("status"))
	query := `SELECT a.id::text, a.organization_id::text, o.name, a.name, a.api_product, a.status, a.created_at
		FROM developer_applications a JOIN developer_organizations o ON o.id = a.organization_id`
	args := []any{}
	if statusFilter != "" {
		query += ` WHERE a.status = $1`
		args = append(args, statusFilter)
	}
	query += ` ORDER BY a.created_at DESC LIMIT 100`
	rows, err := controller.Container.Database.QueryContext(request.Context(), query, args...)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer rows.Close()
	type item struct {
		Id               string `json:"id"`
		OrganizationId   string `json:"organizationId"`
		OrganizationName string `json:"organizationName"`
		Name             string `json:"name"`
		ApiProduct       string `json:"apiProduct"`
		Status           string `json:"status"`
		CreatedAt        string `json:"createdAt"`
	}
	items := []item{}
	for rows.Next() {
		var row item
		if err := rows.Scan(&row.Id, &row.OrganizationId, &row.OrganizationName, &row.Name, &row.ApiProduct, &row.Status, &row.CreatedAt); err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		items = append(items, row)
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"applications": items})
}

func (controller Controller) ReviewApplication(writer http.ResponseWriter, request *http.Request) {
	appId, err := uuid.Parse(request.PathValue("applicationID"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_APPLICATION_ID", "Invalid application ID."))
		return
	}
	var body struct {
		Decision string `json:"decision"`
		Reason   string `json:"reason"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if !slices.Contains([]string{"approved", "rejected", "suspended"}, body.Decision) || len(strings.TrimSpace(body.Reason)) < 3 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_REVIEW", "Decision (approved|rejected|suspended) and reason are required."))
		return
	}
	staff, ok := staffauth.StaffFromContext(request.Context())
	staffId, staffErr := uuid.Parse(staff.Id)
	if !ok || staffErr != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusUnauthorized, "INVALID_STAFF_CONTEXT", "A valid staff identity is required."))
		return
	}
	tx, err := controller.Container.Database.BeginTx(request.Context(), nil)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer tx.Rollback()
	var orgId uuid.UUID
	var previousStatus string
	err = tx.QueryRowContext(request.Context(),
		`SELECT organization_id, status FROM developer_applications WHERE id = $1 FOR UPDATE`, appId,
	).Scan(&orgId, &previousStatus)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if _, err = tx.ExecContext(request.Context(), `UPDATE developer_applications SET status = $1, updated_at = now() WHERE id = $2`, body.Decision, appId); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	err = writeAudit(request.Context(), tx, staff, staffId, orgId, "admin.application."+body.Decision, "developer_application", appId.String(), map[string]any{"status": previousStatus}, map[string]any{"status": body.Decision, "reason": body.Reason})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if err := tx.Commit(); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"id": appId.String(), "status": body.Decision})
}

func (controller Controller) UpdateQuota(writer http.ResponseWriter, request *http.Request) {
	orgId, err := uuid.Parse(request.PathValue("organizationID"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_ORGANIZATION_ID", "Invalid organization ID."))
		return
	}
	var body struct {
		MonthlyQuota int64 `json:"monthlyQuota"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if body.MonthlyQuota < 100 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_QUOTA", "monthlyQuota must be at least 100."))
		return
	}
	staff, ok := staffauth.StaffFromContext(request.Context())
	staffId, staffErr := uuid.Parse(staff.Id)
	if !ok || staffErr != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusUnauthorized, "INVALID_STAFF_CONTEXT", "A valid staff identity is required."))
		return
	}
	tx, err := controller.Container.Database.BeginTx(request.Context(), nil)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer tx.Rollback()
	var planTier, status string
	var previousQuota int64
	var periodEnd sql.NullTime
	var providerReference sql.NullString
	err = tx.QueryRowContext(request.Context(), `SELECT plan_tier, status, monthly_quota, current_period_end, provider_reference FROM developer_billing_subscriptions WHERE organization_id = $1 FOR UPDATE`, orgId).Scan(&planTier, &status, &previousQuota, &periodEnd, &providerReference)
	if err == sql.ErrNoRows {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "BILLING_SUBSCRIPTION_NOT_FOUND", "No existing developer subscription is available for a quota adjustment."))
		return
	}
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if planTier == "sandbox" || status != "active" || !periodEnd.Valid || !periodEnd.Time.After(controller.Container.Now().UTC()) || !providerReference.Valid || strings.TrimSpace(providerReference.String) == "" {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "SUBSCRIPTION_NOT_ACTIVE", "Quota adjustments require an existing active paid subscription."))
		return
	}
	_, err = tx.ExecContext(request.Context(), `UPDATE developer_billing_subscriptions SET monthly_quota = $2, updated_at = now() WHERE organization_id = $1`, orgId, body.MonthlyQuota)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	before := map[string]any{"planTier": planTier, "status": status, "monthlyQuota": previousQuota}
	after := map[string]any{"planTier": planTier, "status": status, "monthlyQuota": body.MonthlyQuota}
	err = writeAudit(request.Context(), tx, staff, staffId, orgId, "admin.billing.quota_adjusted", "developer_organization", orgId.String(), before, after)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if err := tx.Commit(); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"organizationId": orgId.String(), "planTier": planTier, "status": status, "monthlyQuota": body.MonthlyQuota})
}

func writeAudit(ctx context.Context, tx *sql.Tx, staff staffauth.Staff, staffId, organizationId uuid.UUID, action, subjectType, subjectId string, before, after map[string]any) error {
	beforeJSON, err := json.Marshal(before)
	if err != nil {
		return err
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx,
		`INSERT INTO developer_organization_audit_logs (id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,now())`,
		uuid.New(), organizationId, staffId, staff.Role, action, subjectType, subjectId, string(beforeJSON), string(afterJSON),
	)
	return err
}
