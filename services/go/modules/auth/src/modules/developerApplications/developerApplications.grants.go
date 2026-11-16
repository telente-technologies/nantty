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

var errApplicationMemberNotFound = errors.New("application member was not found")

type MemberGrant struct {
	MembershipID         string   `json:"membershipId"`
	AccountID            string   `json:"accountId"`
	Name                 string   `json:"name"`
	Username             string   `json:"username"`
	Role                 string   `json:"role"`
	Capabilities         []string `json:"capabilities"`
	EligibleCapabilities []string `json:"eligibleCapabilities"`
}

type GrantInput struct {
	Capabilities []string `json:"capabilities"`
}

func (service Service) ListMemberGrants(ctx context.Context, accountID, organizationID, applicationID string) ([]MemberGrant, error) {
	account, organization, application, err := parseApplicationRouteIDs(accountID, organizationID, applicationID)
	if err != nil {
		return nil, err
	}
	role, err := service.organizationRole(ctx, account, organization)
	if err != nil {
		return nil, err
	}
	if !canManageApplicationRegistry(role) {
		return nil, errApplicationForbidden
	}
	applicationRecord, err := loadApplication(ctx, service.Container.Database, organization, application)
	if err != nil {
		return nil, err
	}
	if applicationRecord.Status == "archived" {
		return nil, errApplicationNotFound
	}
	rows, err := service.Container.Database.QueryContext(ctx, `
		SELECT m.id, m.account_id, a.name, a.username, m.role, g.capability
		FROM developer_organization_memberships m
		JOIN accounts a ON a.id = m.account_id
		LEFT JOIN developer_application_member_grants g
		  ON g.membership_id = m.id AND g.application_id = $2 AND g.organization_id = m.organization_id
		WHERE m.organization_id = $1
		ORDER BY m.created_at, m.id, g.capability`, organization, application)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]MemberGrant, 0)
	indexByMembership := make(map[string]int)
	for rows.Next() {
		var item MemberGrant
		var capability sql.NullString
		if err := rows.Scan(&item.MembershipID, &item.AccountID, &item.Name, &item.Username, &item.Role, &capability); err != nil {
			return nil, err
		}
		item.Capabilities = []string{}
		item.EligibleCapabilities = developerorganizations.EligibleApplicationCapabilities(item.Role)
		if capability.Valid && developerorganizations.AllowsApplicationCapability(item.Role, capability.String, true) {
			item.Capabilities = append(item.Capabilities, capability.String)
		}
		if index, exists := indexByMembership[item.MembershipID]; exists {
			if capability.Valid && developerorganizations.AllowsApplicationCapability(item.Role, capability.String, true) {
				items[index].Capabilities = append(items[index].Capabilities, capability.String)
			}
			continue
		}
		indexByMembership[item.MembershipID] = len(items)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (service Service) ReplaceMemberGrants(ctx context.Context, accountID, organizationID, applicationID, membershipID string, input GrantInput) (MemberGrant, error) {
	account, organization, application, err := parseApplicationRouteIDs(accountID, organizationID, applicationID)
	if err != nil {
		return MemberGrant{}, err
	}
	member, err := uuid.Parse(membershipID)
	if err != nil {
		return MemberGrant{}, errApplicationMemberNotFound
	}
	capabilities, err := NormalizeDeveloperApplicationGrantCapabilities(input.Capabilities)
	if err != nil {
		return MemberGrant{}, err
	}
	tx, err := service.Container.Database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return MemberGrant{}, err
	}
	defer tx.Rollback()
	actorRole, err := organizationRoleForUpdate(ctx, tx, account, organization)
	if err != nil {
		return MemberGrant{}, err
	}
	if !canManageApplicationRegistry(actorRole) {
		return MemberGrant{}, errApplicationForbidden
	}
	applicationRecord, err := loadApplicationForUpdate(ctx, tx, organization, application)
	if err != nil {
		return MemberGrant{}, err
	}
	if applicationRecord.Status == "archived" {
		return MemberGrant{}, errApplicationNotFound
	}
	var result MemberGrant
	err = tx.QueryRowContext(ctx, `
		SELECT m.id, m.account_id, a.name, a.username, m.role
		FROM developer_organization_memberships m
		JOIN accounts a ON a.id = m.account_id
		WHERE m.id = $1 AND m.organization_id = $2
		FOR UPDATE OF m`, member, organization).
		Scan(&result.MembershipID, &result.AccountID, &result.Name, &result.Username, &result.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return MemberGrant{}, errApplicationMemberNotFound
	}
	if err != nil {
		return MemberGrant{}, err
	}
	eligible := developerorganizations.EligibleApplicationCapabilities(result.Role)
	for _, capability := range capabilities {
		if !containsGrant(eligible, capability) {
			return MemberGrant{}, errInvalidApplicationGrant
		}
	}
	var before []string
	rows, err := tx.QueryContext(ctx, `SELECT capability FROM developer_application_member_grants WHERE organization_id=$1 AND application_id=$2 AND membership_id=$3 ORDER BY capability FOR UPDATE`, organization, application, member)
	if err != nil {
		return MemberGrant{}, err
	}
	for rows.Next() {
		var capability string
		if err := rows.Scan(&capability); err != nil {
			rows.Close()
			return MemberGrant{}, err
		}
		if containsGrant(eligible, capability) {
			before = append(before, capability)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return MemberGrant{}, err
	}
	if err := rows.Close(); err != nil {
		return MemberGrant{}, err
	}
	if !sameGrantCapabilities(before, capabilities) {
		if _, err := tx.ExecContext(ctx, `DELETE FROM developer_application_member_grants WHERE organization_id=$1 AND application_id=$2 AND membership_id=$3`, organization, application, member); err != nil {
			return MemberGrant{}, err
		}
		now := service.Container.Now()
		for _, capability := range capabilities {
			if _, err := tx.ExecContext(ctx, `INSERT INTO developer_application_member_grants (organization_id, application_id, membership_id, capability, granted_by_account_id, created_at) VALUES ($1,$2,$3,$4,$5,$6)`, organization, application, member, capability, account, now); err != nil {
				return MemberGrant{}, err
			}
		}
		if err := writeApplicationGrantAudit(ctx, tx, organization, account, application, member, actorRole, before, capabilities, now); err != nil {
			return MemberGrant{}, err
		}
	}
	result.Capabilities = capabilities
	result.EligibleCapabilities = eligible
	if err := tx.Commit(); err != nil {
		return MemberGrant{}, err
	}
	return result, nil
}

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
