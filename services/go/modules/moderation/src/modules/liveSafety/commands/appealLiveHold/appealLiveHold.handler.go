package appeallivehold

import (
	"context"
	"net/http"
	"strings"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/livesafetyincident"
	"nantty/modules/moderation/src/modules/liveSafety/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	message := strings.TrimSpace(command.Message)
	if len([]rune(message)) > 1000 {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "message", Message: "must be at most 1000 characters"}})
	}
	incident, err := services.FindOpenIncident(ctx, handler.Container.Client, command.LiveId)
	if err != nil {
		return Result{}, err
	}
	if incident == nil || !incident.HoldActive || services.HostIdString(incident) != command.UserId {
		return Result{}, httpserver.NewApiError(http.StatusNotFound, "NO_ACTIVE_HOLD", "There's no paused live to appeal.")
	}
	if incident.AppealedAt != nil {
		return Result{}, httpserver.NewApiError(http.StatusConflict, "ALREADY_APPEALED", "You've already appealed. Our safety team is reviewing your live.")
	}
	now := handler.Container.Now()
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return tx.LiveSafetyIncident.UpdateOne(incident).SetAppealedAt(now).SetAppealMessage(message).SetPriority(livesafetyincident.PriorityUrgent).
			SetSLADueAt(now.Add(services.SlaForPriority("urgent"))).SetUpdatedAt(now).Exec(ctx)
	})
	return Result{Status: "received", IncidentId: incident.ID.String()}, err
}
