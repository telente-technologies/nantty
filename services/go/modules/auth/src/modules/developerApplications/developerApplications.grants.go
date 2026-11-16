package developerapplications

import (
	"context"
	"database/sql"
	"errors"

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
