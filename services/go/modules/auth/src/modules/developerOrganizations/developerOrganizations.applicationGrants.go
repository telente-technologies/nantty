package developerorganizations

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

func pruneApplicationGrantsForRole(ctx context.Context, tx *sql.Tx, organizationID, actorID, membershipID uuid.UUID, actorRole, newRole string, now time.Time) error {
	eligible := EligibleApplicationCapabilities(newRole)
	rows, err := tx.QueryContext(ctx, `SELECT DISTINCT application_id FROM developer_application_member_grants WHERE organization_id=$1 AND membership_id=$2 ORDER BY application_id`, organizationID, membershipID)
	if err != nil {
		return err
	}
	applicationIDs := make([]uuid.UUID, 0)
	for rows.Next() {
		var applicationID uuid.UUID
		if err := rows.Scan(&applicationID); err != nil {
			rows.Close()
			return err
		}
		applicationIDs = append(applicationIDs, applicationID)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, applicationID := range applicationIDs {
		capabilityRows, err := tx.QueryContext(ctx, `SELECT capability FROM developer_application_member_grants WHERE organization_id=$1 AND application_id=$2 AND membership_id=$3 ORDER BY capability FOR UPDATE`, organizationID, applicationID, membershipID)
		if err != nil {
			return err
		}
		before := make([]string, 0)
		for capabilityRows.Next() {
			var capability string
			if err := capabilityRows.Scan(&capability); err != nil {
				capabilityRows.Close()
				return err
			}
			before = append(before, capability)
		}
		if err := capabilityRows.Err(); err != nil {
			capabilityRows.Close()
			return err
		}
		if err := capabilityRows.Close(); err != nil {
			return err
		}
		after := make([]string, 0, len(before))
		for _, capability := range before {
			if containsCapability(eligible, capability) {
				after = append(after, capability)
			}
		}
		if len(after) == len(before) {
			continue
		}
		for _, capability := range before {
			if !containsCapability(eligible, capability) {
				if _, err := tx.ExecContext(ctx, `DELETE FROM developer_application_member_grants WHERE organization_id=$1 AND application_id=$2 AND membership_id=$3 AND capability=$4`, organizationID, applicationID, membershipID, capability); err != nil {
					return err
				}
			}
		}
		beforeState, err := json.Marshal(map[string]any{"applicationId": applicationID.String(), "membershipId": membershipID.String(), "capabilities": before})
		if err != nil {
			return err
		}
		afterState, err := json.Marshal(map[string]any{"applicationId": applicationID.String(), "membershipId": membershipID.String(), "capabilities": after, "reason": "organization_role_changed"})
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO developer_organization_audit_logs
			(id,organization_id,actor_account_id,actor_role,action,subject_type,subject_id,before_state,after_state,created_at)
			VALUES ($1,$2,$3,$4,'application.member_grants_pruned','developer_application_grant',$5,$6,$7,$8)`, uuid.New(), organizationID, actorID, actorRole, membershipID.String(), beforeState, afterState, now); err != nil {
			return err
		}
	}
	return nil
}
