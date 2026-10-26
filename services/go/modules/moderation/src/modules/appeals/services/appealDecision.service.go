package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/appeal"
	"nantty/platform/staffauth"
)

func EncodeDecision(outcome appeal.Status, reason string, staff staffauth.Staff, now time.Time) []byte {
	encoded, _ := json.Marshal(Decision{Outcome: string(outcome), Reason: reason, DecidedByName: staff.Name, DecidedByStaffId: staff.Id, DecidedAt: format(now)})
	return encoded
}

func SyncStrikeDecision(ctx context.Context, tx *ent.Tx, strikeId uuid.UUID, outcome appeal.Status, reason string, staff staffauth.Staff, now time.Time) error {
	return tx.Appeal.Update().Where(appeal.StrikeID(strikeId), appeal.StatusEQ(appeal.StatusPending)).SetStatus(outcome).SetDecision(EncodeDecision(outcome, reason, staff, now)).Exec(ctx)
}
