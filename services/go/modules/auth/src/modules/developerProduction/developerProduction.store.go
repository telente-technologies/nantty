package developerproduction

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	developerorganizations "nantty/modules/auth/src/modules/developerOrganizations"
	"nantty/platform/httpserver"
)

type CredentialView struct {
	Id         string     `json:"id"`
	Name       string     `json:"name"`
	Prefix     string     `json:"prefix"`
	Scopes     []string   `json:"scopes"`
	Status     string     `json:"status"`
	CreatedAt  time.Time  `json:"createdAt"`
	LastUsedAt *time.Time `json:"lastUsedAt,omitempty"`
}

type WebhookView struct {
	Id                   string     `json:"id"`
	Url                  string     `json:"url"`
	Events               []string   `json:"events"`
	Active               bool       `json:"active"`
	SigningSecretPreview string     `json:"signingSecretPreview"`
	VerifiedAt           *time.Time `json:"verifiedAt,omitempty"`
	CreatedAt            time.Time  `json:"createdAt"`
}

type BillingView struct {
	OrganizationId   string     `json:"organizationId"`
	PlanTier         string     `json:"planTier"`
	Status           string     `json:"status"`
	MonthlyQuota     int64      `json:"monthlyQuota"`
	UsedThisMonth    int64      `json:"usedThisMonth"`
	CurrentPeriodEnd *time.Time `json:"currentPeriodEnd,omitempty"`
}

type RequestLogView struct {
	Id         string    `json:"id"`
	Method     string    `json:"method"`
	Path       string    `json:"path"`
	StatusCode int       `json:"statusCode"`
	LatencyMs  int       `json:"latencyMs"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Store struct {
	Container *container.Container
}

func (store Store) RequireOrganizationCapability(ctx context.Context, accountID, organizationID, capability string) (uuid.UUID, string, error) {
	orgUUID, err := uuid.Parse(organizationID)
	if err != nil {
		return uuid.Nil, "", httpserver.NewApiError(http.StatusBadRequest, "INVALID_ORGANIZATION_ID", "Invalid organization ID.")
	}
	accUUID, err := uuid.Parse(accountID)
	if err != nil {
		return uuid.Nil, "", httpserver.ErrUnauthorized
	}
	var role string
	err = store.Container.Database.QueryRowContext(ctx,
		`SELECT role FROM developer_organization_memberships WHERE organization_id = $1 AND account_id = $2`,
		orgUUID, accUUID,
	).Scan(&role)
	if err == sql.ErrNoRows {
		return uuid.Nil, "", httpserver.NewApiError(http.StatusNotFound, "ORGANIZATION_NOT_FOUND", "Developer organization not found.")
	}
	if err != nil {
		return uuid.Nil, "", err
	}
	if !developerorganizations.AllowsOrganizationCapability(role, capability) {
		return uuid.Nil, role, httpserver.NewApiError(http.StatusForbidden, "FORBIDDEN", "Your organization role lacks permission: "+capability)
	}
	return orgUUID, role, nil
}

func (store Store) RequireMemberAndApprovedApp(ctx context.Context, accountID, organizationID, applicationID, requiredCapability string, requireApproved bool) (uuid.UUID, uuid.UUID, string, error) {
	orgUUID, err := uuid.Parse(organizationID)
	if err != nil {
		return uuid.Nil, uuid.Nil, "", httpserver.NewApiError(http.StatusBadRequest, "INVALID_ORGANIZATION_ID", "Invalid organization ID.")
	}
	appUUID, err := uuid.Parse(applicationID)
	if err != nil {
		return uuid.Nil, uuid.Nil, "", httpserver.NewApiError(http.StatusBadRequest, "INVALID_APPLICATION_ID", "Invalid application ID.")
	}
	accUUID, err := uuid.Parse(accountID)
	if err != nil {
		return uuid.Nil, uuid.Nil, "", httpserver.ErrUnauthorized
	}
	var membershipUUID uuid.UUID
	var role, status string
	err = store.Container.Database.QueryRowContext(ctx,
		`SELECT m.id, m.role, a.status
		 FROM developer_organization_memberships m
		 JOIN developer_applications a ON a.organization_id = m.organization_id
		 WHERE m.organization_id = $1 AND m.account_id = $2 AND a.id = $3 AND a.status <> 'archived'`,
		orgUUID, accUUID, appUUID,
	).Scan(&membershipUUID, &role, &status)
	if err == sql.ErrNoRows {
		return uuid.Nil, uuid.Nil, "", httpserver.NewApiError(http.StatusNotFound, "APPLICATION_NOT_FOUND", "Developer application not found.")
	}
	if err != nil {
		return uuid.Nil, uuid.Nil, "", err
	}
	if requiredCapability != "" && role != "owner" && role != "admin" {
		if !developerorganizations.AllowsApplicationCapability(role, requiredCapability, true) {
			return uuid.Nil, uuid.Nil, role, httpserver.NewApiError(http.StatusForbidden, "FORBIDDEN", "Role lacks application capability: "+requiredCapability)
		}
		var granted bool
		err = store.Container.Database.QueryRowContext(ctx,
			`SELECT EXISTS (
				SELECT 1 FROM developer_application_member_grants
				WHERE organization_id = $1 AND application_id = $2 AND membership_id = $3 AND capability = $4
			)`, orgUUID, appUUID, membershipUUID, requiredCapability,
		).Scan(&granted)
		if err != nil {
			return uuid.Nil, uuid.Nil, "", err
		}
		if !granted {
			return uuid.Nil, uuid.Nil, role, httpserver.NewApiError(http.StatusForbidden, "INSUFFICIENT_APPLICATION_PERMISSION", "Application grant required for: "+requiredCapability)
		}
	}
	if requireApproved && status != "approved" {
		return uuid.Nil, uuid.Nil, status, httpserver.NewApiError(
			http.StatusForbidden, "APPLICATION_NOT_APPROVED", "Production credentials and webhooks require an approved application.",
		)
	}
	return orgUUID, appUUID, role, nil
}

func IsSafePublicHttpsUrl(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "" || host == "localhost" || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") {
		return false
	}
	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
			return false
		}
	}
	return true
}

func Sha256Hex(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
