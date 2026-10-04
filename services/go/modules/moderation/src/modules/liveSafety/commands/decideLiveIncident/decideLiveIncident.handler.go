package decideliveincident

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/livesafetyincident"
	"zudomart/modules/moderation/src/integrations"
	"zudomart/modules/moderation/src/modules/liveSafety/services"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

var knownActions = []string{ActionKeepLive, ActionKeepPaused, ActionEndLive, ActionEndAndSuspend}

var suspensionDurations = []int{1, 3, 7, 30}

func invalid(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	reason := strings.TrimSpace(command.Reason)
	switch {
	case !slices.Contains(knownActions, command.Action):
		return invalid("action", "must be keep_live, keep_paused, end_live or end_and_suspend")
	case len(reason) < 5 || len(reason) > 1000:
		return invalid("reason", "must be 5 to 1000 characters")
	case command.Action == ActionEndAndSuspend && !command.Staff.SteppedUp:
		return httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue.")
	case command.Action == ActionEndAndSuspend && (command.DurationDays == nil || !slices.Contains(suspensionDurations, *command.DurationDays)):
		return invalid("durationDays", "must be 1, 3, 7 or 30")
	}
	identifier, err := uuid.Parse(command.IncidentId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	incident, err := handler.Container.Client.LiveSafetyIncident.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	if incident.Status == livesafetyincident.StatusClosed {
		return httpserver.NewApiError(http.StatusConflict, "INCIDENT_ALREADY_CLOSED", "Someone already closed this incident. Reload to see the outcome.")
	}
	if (command.Action == ActionEndAndSuspend || command.Action == ActionKeepPaused) && incident.HostID == nil {
		return httpserver.NewApiError(http.StatusConflict, "HOST_UNKNOWN", "The host of this live could not be determined.")
	}
	if command.Action == ActionEndAndSuspend {
		actor := integrations.StaffActor{Id: command.Staff.Id, Name: command.Staff.Name, Role: command.Staff.Role, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUp: true}
		if err := handler.Container.Users.Enforce(ctx, integrations.EnforcementRequest{
			Action: "suspend", UserId: incident.HostID.String(), Actor: actor, Reason: "Live safety incident: " + reason, DurationDays: command.DurationDays, ReasonCode: "OTHER", Source: "live_safety", CaseId: incident.ID.String(),
		}); err != nil {
			return err
		}
	}
	return handler.record(ctx, command, incident, reason)
}

func (handler Handler) record(ctx context.Context, command Command, incident *ent.LiveSafetyIncident, reason string) error {
	now := handler.Container.Now()
	before, _ := json.Marshal(map[string]any{"status": incident.Status, "holdActive": incident.HoldActive, "priority": incident.Priority})
	decision, _ := json.Marshal(map[string]any{"action": command.Action, "reason": reason, "decidedByName": command.Staff.Name, "decidedByStaffId": command.Staff.Id, "decidedAt": now.UTC().Format(time.RFC3339), "suspensionDays": command.DurationDays})
	var after *ent.LiveSafetyIncident
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := tx.LiveSafetyIncident.Query().Where(livesafetyincident.ID(incident.ID), livesafetyincident.StatusEQ(livesafetyincident.StatusOpen)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.NewApiError(http.StatusConflict, "INCIDENT_ALREADY_CLOSED", "Someone already closed this incident. Reload to see the outcome.")
		}
		if err != nil {
			return err
		}
		if locked, err = handler.applyAction(ctx, tx, locked, command.Action, reason, now); err != nil {
			return err
		}
		update := tx.LiveSafetyIncident.UpdateOne(locked).SetResolution(command.Action).SetDecision(decision).SetUpdatedAt(now)
		if command.Action == ActionKeepPaused {
			update.SetPriority(livesafetyincident.PriorityNormal)
		} else {
			update.SetStatus(livesafetyincident.StatusClosed)
		}
		if after, err = update.Save(ctx); err != nil {
			return err
		}
		if command.Action != ActionKeepLive && locked.HostID != nil {
			category := firstNonEmpty(locked.HoldCategory, locked.TopCategory)
			if _, _, err := (strikeservices.Recorder{Now: handler.Container.Now}).Issue(ctx, tx, strikeservices.IssueParams{
				AccountId: *locked.HostID, Kind: "strike", Policy: services.StrikePolicyForLiveCategory(category), Reason: reason, Source: "moderation",
				IssuedById: command.Staff.Id, IssuedByName: command.Staff.Name, ReferenceType: "live_safety_incident", ReferenceId: locked.ID.String(),
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	afterJson, _ := json.Marshal(map[string]any{"status": after.Status, "holdActive": after.HoldActive, "resolution": after.Resolution})
	return handler.Container.Audit.Record(ctx, integrations.AuditRecord{
		ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "liveIncident." + command.Action, SubjectType: "live_safety_incident", SubjectId: incident.ID.String(),
		SubjectLabel: "live " + incident.LiveID, Before: before, After: afterJson, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUpVerified: command.Staff.SteppedUp,
	})
}

func (handler Handler) applyAction(ctx context.Context, tx *ent.Tx, incident *ent.LiveSafetyIncident, action, reason string, now time.Time) (*ent.LiveSafetyIncident, error) {
	switch action {
	case ActionKeepLive:
		return services.ReleaseHoldInTransaction(ctx, tx, incident, now)
	case ActionKeepPaused:
		return services.ApplyHoldInTransaction(ctx, tx, incident, firstNonEmpty(incident.HoldCategory, incident.TopCategory), "moderator", incident.TopConfidence, now)
	}
	return incident, services.PublishModeratorEndInTransaction(ctx, tx, incident, reason, action == ActionEndAndSuspend, now)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
