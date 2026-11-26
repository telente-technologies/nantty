package developerproduction

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

func (controller Controller) ListRequests(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, appUUID, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "request_logs.read", false)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	rows, err := controller.Container.Database.QueryContext(request.Context(),
		`SELECT id::text, method, path, status_code, latency_ms, created_at FROM developer_production_requests WHERE organization_id = $1 AND application_id = $2 ORDER BY created_at DESC LIMIT 50`,
		orgUUID, appUUID,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer rows.Close()
	items := []RequestLogView{}
	for rows.Next() {
		var r RequestLogView
		if err := rows.Scan(&r.Id, &r.Method, &r.Path, &r.StatusCode, &r.LatencyMs, &r.CreatedAt); err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		items = append(items, r)
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"requests": items})
}

func (controller Controller) GetUsage(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, _, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "usage.read", false)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	total, err := ProductionUsageCount(request.Context(), controller.Container.Database, orgUUID)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var quota int64
	var tier, status string
	var periodEnd, paymentVerifiedAt sql.NullTime
	var providerReference sql.NullString
	if err := controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT plan_tier, status, monthly_quota, current_period_end, provider_reference, payment_verified_at FROM developer_billing_subscriptions WHERE organization_id = $1`, orgUUID,
	).Scan(&tier, &status, &quota, &periodEnd, &providerReference, &paymentVerifiedAt); err != nil && err != sql.ErrNoRows {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	quota = EffectiveMonthlyQuota(tier, status, quota, periodEnd, paymentVerifiedAt, providerReference, time.Now().UTC())
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"usedThisMonth": total, "monthlyQuota": quota})
}

func (controller Controller) GetBilling(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, _, err := controller.store().RequireOrganizationCapability(request.Context(), principal.UserId, request.PathValue("organizationID"), "billing.read")
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	view := BillingView{OrganizationId: orgUUID.String(), PlanTier: "sandbox", Status: "active", MonthlyQuota: 10000}
	var periodEnd, paymentVerifiedAt sql.NullTime
	var providerReference sql.NullString
	if err := controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT plan_tier, status, monthly_quota, current_period_end, provider_reference, payment_verified_at FROM developer_billing_subscriptions WHERE organization_id = $1`, orgUUID,
	).Scan(&view.PlanTier, &view.Status, &view.MonthlyQuota, &periodEnd, &providerReference, &paymentVerifiedAt); err != nil && err != sql.ErrNoRows {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if periodEnd.Valid {
		view.CurrentPeriodEnd = &periodEnd.Time
	}
	view.Status = EffectiveBillingStatus(view.PlanTier, view.Status, periodEnd, paymentVerifiedAt, providerReference, time.Now().UTC())
	view.UsedThisMonth, err = ProductionUsageCount(request.Context(), controller.Container.Database, orgUUID)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller Controller) CheckoutBilling(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, _, err := controller.store().RequireOrganizationCapability(request.Context(), principal.UserId, request.PathValue("organizationID"), "billing.manage")
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var body struct {
		PlanTier         string `json:"planTier"`
		PaymentReference string `json:"paymentReference,omitempty"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	quotas := map[string]int64{"sandbox": 10000, "starter": 100000, "growth": 1000000, "enterprise": 10000000}
	quota, ok := quotas[body.PlanTier]
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_PLAN_TIER", "Unsupported plan tier."))
		return
	}
	if body.PlanTier != "sandbox" {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusServiceUnavailable, "BILLING_PAYMENT_VERIFICATION_UNAVAILABLE", "Paid plans are not available yet."))
		return
	}
	err = SetSandboxBilling(request.Context(), controller.Container.Database, orgUUID, quota)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, BillingView{OrganizationId: orgUUID.String(), PlanTier: body.PlanTier, Status: "active", MonthlyQuota: quota})
}

func verifyPaidPlanSettlement(ctx context.Context, orgUUID uuid.UUID, planTier, paymentRef string) error {
	if paymentRef == "" {
		return httpserver.NewApiError(http.StatusPaymentRequired, "PAYMENT_VERIFICATION_REQUIRED", "Paid plan upgrades require a verified payment reference.")
	}
	paymentsUrl := strings.TrimRight(strings.TrimSpace(os.Getenv("DEVELOPER_BILLING_PAYMENTS_INTERNAL_URL")), "/")
	paymentsToken := strings.TrimSpace(os.Getenv("DEVELOPER_BILLING_PAYMENTS_INTERNAL_TOKEN"))
	if paymentsUrl == "" || paymentsToken == "" {
		return httpserver.NewApiError(http.StatusServiceUnavailable, "BILLING_PAYMENT_VERIFICATION_UNAVAILABLE", "Paid plan checkout verification is not configured on this environment.")
	}
	encoded, _ := json.Marshal(map[string]string{
		"organizationId":   orgUUID.String(),
		"planTier":         planTier,
		"paymentReference": paymentRef,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, paymentsUrl+"/api/v1/internal/payments/verify-developer-plan", bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", paymentsToken)
	resp, err := NewInternalServiceHTTPClient().Do(req)
	if err != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if resp != nil {
			_ = resp.Body.Close()
		}
		return httpserver.NewApiError(http.StatusPaymentRequired, "PAYMENT_NOT_VERIFIED", "Payment reference could not be verified.")
	}
	defer resp.Body.Close()
	var result struct {
		Verified       bool   `json:"verified"`
		OrganizationId string `json:"organizationId"`
		PlanTier       string `json:"planTier"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || !result.Verified || result.OrganizationId != orgUUID.String() || result.PlanTier != planTier {
		return httpserver.NewApiError(http.StatusPaymentRequired, "PAYMENT_NOT_VERIFIED", "Verified payment does not match this organization and plan tier.")
	}
	return nil
}
