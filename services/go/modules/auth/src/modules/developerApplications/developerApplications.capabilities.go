package developerapplications

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"github.com/google/uuid"
	developerorganizations "nantty/modules/auth/src/modules/developerOrganizations"
)

func (service Service) HasCapability(ctx context.Context, accountID, organizationID, applicationID, capability string) (bool, error) {
	account, organization, application, err := parseApplicationRouteIDs(accountID, organizationID, applicationID)
	if err != nil {
		return false, err
	}
	if !knownGrantCapability(capability) {
		return false, nil
	}
	var role string
	err = service.Container.Database.QueryRowContext(ctx, `
		SELECT m.role
		FROM developer_organization_memberships m
		JOIN developer_applications a ON a.organization_id=m.organization_id AND a.id=$3 AND a.status <> 'archived'
		WHERE m.account_id=$1 AND m.organization_id=$2`, account, organization, application).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return false, errApplicationNotFound
	}
	if err != nil {
		return false, err
	}
	if !developerorganizations.AllowsApplicationCapability(role, capability, true) {
		return false, nil
	}
	var granted bool
	err = service.Container.Database.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM developer_application_member_grants g
			JOIN developer_organization_memberships m ON m.id=g.membership_id AND m.organization_id=g.organization_id
			WHERE g.organization_id=$1 AND g.application_id=$2 AND m.account_id=$3 AND g.capability=$4
		)`, organization, application, account, capability).Scan(&granted)
	return granted, err
}

func (service Service) EffectiveCapabilities(ctx context.Context, accountID, organizationID, applicationID string) (EffectiveApplicationCapabilities, error) {
	account, organization, application, err := parseApplicationRouteIDs(accountID, organizationID, applicationID)
	if err != nil {
		return EffectiveApplicationCapabilities{}, err
	}
	rows, err := service.Container.Database.QueryContext(ctx, `
		SELECT a.name, m.role, g.capability
		FROM developer_organization_memberships m
		JOIN developer_applications a ON a.organization_id=m.organization_id AND a.id=$3 AND a.status <> 'archived'
		LEFT JOIN developer_application_member_grants g
		  ON g.organization_id=m.organization_id AND g.application_id=a.id AND g.membership_id=m.id
	WHERE m.account_id=$1 AND m.organization_id=$2
	ORDER BY g.capability`, account, organization, application)
	if err != nil {
		return EffectiveApplicationCapabilities{}, err
	}
	defer rows.Close()
	role := ""
	applicationName := ""
	granted := make([]string, 0)
	for rows.Next() {
		var rowRole string
		var rowApplicationName string
		var capability sql.NullString
		if err := rows.Scan(&rowApplicationName, &rowRole, &capability); err != nil {
			return EffectiveApplicationCapabilities{}, err
		}
		role = rowRole
		applicationName = rowApplicationName
		if capability.Valid && knownGrantCapability(capability.String) {
			granted = append(granted, capability.String)
		}
	}
	if err := rows.Err(); err != nil {
		return EffectiveApplicationCapabilities{}, err
	}
	if role == "" {
		return EffectiveApplicationCapabilities{}, errApplicationNotFound
	}
	result := EffectiveApplicationCapabilities{ActorAccountID: account.String(), OrganizationID: organization.String(), ApplicationID: application.String(), ApplicationName: applicationName}
	if canManageApplicationRegistry(role) {
		result.Capabilities = developerorganizations.EligibleApplicationCapabilities(role)
		return result, nil
	}
	result.Capabilities, _ = developerorganizations.ApplicationCapabilitiesForGrant(role, granted)
	return result, nil
}

func NormalizeDeveloperApplicationGrantCapabilities(values []string) ([]string, error) {
	if values == nil || len(values) > len(allGrantCapabilities) {
		return nil, errInvalidApplicationGrant
	}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if !knownGrantCapability(value) {
			return nil, errInvalidApplicationGrant
		}
		if !containsGrant(result, value) {
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result, nil
}

var allGrantCapabilities = []string{"applications.read", "credentials.manage", "webhooks.manage", "request_logs.read", "usage.read"}

func knownGrantCapability(value string) bool { return containsGrant(allGrantCapabilities, value) }

func containsGrant(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}

func sameGrantCapabilities(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func writeApplicationGrantAudit(ctx context.Context, tx *sql.Tx, organizationID, actorID, applicationID, membershipID uuid.UUID, actorRole string, before, after []string, now time.Time) error {
	beforeState, err := json.Marshal(map[string]any{"applicationId": applicationID.String(), "membershipId": membershipID.String(), "capabilities": before})
	if err != nil {
		return err
	}
	afterState, err := json.Marshal(map[string]any{"applicationId": applicationID.String(), "membershipId": membershipID.String(), "capabilities": after})
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO developer_organization_audit_logs
		(id, organization_id, actor_account_id, actor_role, action, subject_type, subject_id, before_state, after_state, created_at)
		VALUES ($1,$2,$3,$4,'application.member_grants_replaced','developer_application_grant',$5,$6,$7,$8)`,
		uuid.New(), organizationID, actorID, actorRole, membershipID.String(), beforeState, afterState, now)
	return err
}
