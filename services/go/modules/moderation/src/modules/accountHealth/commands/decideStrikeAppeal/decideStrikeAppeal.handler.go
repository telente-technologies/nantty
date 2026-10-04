package decidestrikeappeal

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/strike"
	"zudomart/modules/moderation/src/integrations"
	"zudomart/modules/moderation/src/modules/accountHealth/services"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
	"zudomart/platform/httpserver"
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
			Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId,
		})
	})
	if err != nil {
		return err
	}
	if _, healthErr := services.PublishHealthChanged(ctx, handler.Container, row.AccountID, "strike_appeal_"+string(outcome)); healthErr != nil {
		handler.Container.Logger.WarnContext(ctx, "account health event failed", "error", healthErr.Error())
	}
	return nil
}
