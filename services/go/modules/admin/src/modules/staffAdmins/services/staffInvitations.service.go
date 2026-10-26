package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/platformsetting"
	secrettokens "nantty/modules/admin/src/utils/secretTokens"
)

func CreateInvitationInTransaction(ctx context.Context, tx *ent.Tx, staffId uuid.UUID, token string, expiresAt time.Time) error {
	return tx.StaffInvitation.Create().SetStaffID(staffId).SetTokenHash(secrettokens.HashOpaqueTokenForStorage(token)).SetExpiresAt(expiresAt).Exec(ctx)
}

func SecondSuperadminApprovalRequired(ctx context.Context, client *ent.Client) bool {
	row, err := client.PlatformSetting.Query().Where(platformsetting.Key("staff.settings")).Only(ctx)
	if err != nil {
		return true
	}
	var value struct {
		Require bool `json:"requireSecondSuperadminApproval"`
	}
	if json.Unmarshal(row.Value, &value) != nil {
		return true
	}
	return value.Require
}
