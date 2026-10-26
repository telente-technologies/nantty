package decidestrikeappeal

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/appeal"
	"nantty/modules/moderation/src/generated/ent/strike"
	"nantty/modules/moderation/src/integrations"
	decideappeal "nantty/modules/moderation/src/modules/appeals/commands/decideAppeal"
	strikeservices "nantty/modules/moderation/src/modules/strikes/services"
	"nantty/platform/httpserver"
)

const StrikeAppealDecidedType = "strike.appealDecided"

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	reason := strings.TrimSpace(command.Reason)
	if len(reason) < 5 || len(reason) > 1000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	}
	if command.Action != "uphold" && command.Action != "overturn" {
		return httpserver.ErrNotFound
	}
	if command.Action == "overturn" && !command.Staff.SteppedUp {
		return httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue.")
	}
	identifier, err := uuid.Parse(command.StrikeId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	row, err := handler.Container.Client.Strike.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	if row.AppealStatus != strike.AppealStatusPending {
		return httpserver.NewApiError(http.StatusConflict, "APPEAL_NOT_PENDING", "This strike has no pending appeal.")
	}
	unified, err := handler.Container.Client.Appeal.Query().Where(appeal.StrikeID(row.ID), appeal.StatusEQ(appeal.StatusPending)).First(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return err
	}
	if unified != nil {
		return decideappeal.Handler{Container: handler.Container}.Execute(ctx, decideappeal.Command{
			Staff: command.Staff, IpAddress: command.IpAddress, RequestId: command.RequestId, AppealId: unified.ID.String(), Outcome: map[string]string{"uphold": "UPHELD", "overturn": "OVERTURNED"}[command.Action], Reason: reason,
		})
	}
	outcome := map[string]strike.AppealStatus{"uphold": strike.AppealStatusUpheld, "overturn": strike.AppealStatusOverturned}[command.Action]
	now := handler.Container.Now()
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.Strike.UpdateOne(row).SetAppealStatus(outcome).Exec(ctx); err != nil {
			return err
		}
		if command.Action == "overturn" {
			if _, err := (strikeservices.Recorder{Now: handler.Container.Now}).Revoke(ctx, tx, row.ID, "Appeal overturned: "+reason); err != nil {
				return err
			}
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, StrikeAppealDecidedType, row.ID.String(), now, map[string]string{"strikeId": row.ID.String(), "accountId": row.AccountID.String(), "outcome": string(outcome), "reason": reason}); err != nil {
			return err
		}
		before, _ := json.Marshal(map[string]any{"appealStatus": row.AppealStatus})
		after, _ := json.Marshal(map[string]any{"appealStatus": outcome})
		return handler.Container.Audit.Record(ctx, integrations.AuditRecord{
			ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "strike.appeal_" + string(outcome), SubjectType: "user", SubjectId: row.AccountID.String(), SubjectLabel: row.Policy,
			Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUpVerified: command.Staff.SteppedUp,
		})
	})
	return err
}
