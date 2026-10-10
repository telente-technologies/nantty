package decideappeal

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/appeal"
	"zudomart/modules/moderation/src/generated/ent/contentreport"
	"zudomart/modules/moderation/src/generated/ent/strike"
	"zudomart/modules/moderation/src/integrations"
	healthservices "zudomart/modules/moderation/src/modules/accountHealth/services"
	"zudomart/modules/moderation/src/modules/appeals/services"
	reportservices "zudomart/modules/moderation/src/modules/contentReports/services"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
	"zudomart/platform/httpserver"
)

const AppealDecidedType = "appeal.decided"

var restoresContent = map[appeal.DecisionType]bool{appeal.DecisionTypeContentRemoved: true, appeal.DecisionTypeContentRestricted: true, appeal.DecisionTypeSuspension: true}

type Handler struct {
	Container *container.Container
}

type effects struct {
	visibilityBefore string
	visibilityAfter  string
	strikeRevoked    bool
	suspensionLifted bool
}

func alreadyDecided() error {
	return httpserver.NewApiError(http.StatusConflict, "APPEAL_ALREADY_DECIDED", "This appeal was already decided.")
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	outcome := map[string]appeal.Status{"UPHELD": appeal.StatusUpheld, "OVERTURNED": appeal.StatusOverturned}[command.Outcome]
	reason := strings.TrimSpace(command.Reason)
	switch {
	case outcome == "":
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "outcome", Message: "must be UPHELD or OVERTURNED"}})
	case len([]rune(reason)) < 5 || len([]rune(reason)) > 1000:
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	case outcome == appeal.StatusOverturned && !command.Staff.SteppedUp:
		return httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue.")
	}
	identifier, err := uuid.Parse(command.AppealId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	row, err := handler.Container.Client.Appeal.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	if row.Status != appeal.StatusPending {
		return alreadyDecided()
	}
	if original := services.ReadOriginal(row); original.DecidedByStaffId != "" && original.DecidedByStaffId == command.Staff.Id {
		return httpserver.NewApiError(http.StatusConflict, "SAME_REVIEWER", "Another reviewer must decide an appeal against your own decision.")
	}
	applied := effects{}
	if outcome == appeal.StatusOverturned && row.DecisionType == appeal.DecisionTypeSuspension {
		actor := integrations.StaffActor{Id: command.Staff.Id, Name: command.Staff.Name, Role: command.Staff.Role, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUp: command.Staff.SteppedUp}
		if err := handler.Container.Users.Enforce(ctx, integrations.EnforcementRequest{Action: "reinstate", UserId: row.AppellantID.String(), Actor: actor, Reason: "Appeal overturned: " + reason, Source: "appeal", CaseId: row.ID.String()}); err != nil {
			return err
		}
		applied.suspensionLifted = true
	}
	now := handler.Container.Now()
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := tx.Appeal.Query().Where(appeal.ID(row.ID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if locked.Status != appeal.StatusPending {
			return alreadyDecided()
		}
		if err := tx.Appeal.UpdateOne(locked).SetStatus(outcome).SetDecision(services.EncodeDecision(outcome, reason, command.Staff, now)).Exec(ctx); err != nil {
			return err
		}
		if err := handler.applyToStrike(ctx, tx, locked, outcome, reason, now, &applied); err != nil {
			return err
		}
		if err := handler.restoreTarget(ctx, tx, locked, outcome, reason, now, &applied); err != nil {
			return err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, AppealDecidedType, locked.ID.String(), now, map[string]string{
			"accountId": locked.AppellantID.String(), "caseId": locked.ID.String(), "outcome": string(outcome), "explanation": reason,
		}); err != nil {
			return err
		}
		return handler.audit(ctx, command, locked, outcome, reason, applied)
	})
	if err != nil {
		return err
	}
	if row.StrikeID != nil {
		if _, healthErr := healthservices.PublishHealthChanged(ctx, handler.Container, row.AppellantID, "appeal_"+string(outcome)); healthErr != nil {
			handler.Container.Logger.WarnContext(ctx, "account health event failed", "error", healthErr.Error())
		}
	}
	return nil
}

func (handler Handler) applyToStrike(ctx context.Context, tx *ent.Tx, row *ent.Appeal, outcome appeal.Status, reason string, now time.Time, applied *effects) error {
	if row.StrikeID == nil {
		return nil
	}
	if err := tx.Strike.Update().Where(strike.ID(*row.StrikeID)).SetAppealStatus(strike.AppealStatus(outcome)).Exec(ctx); err != nil {
		return err
	}
	if outcome == appeal.StatusOverturned {
		if _, err := (strikeservices.Recorder{Now: handler.Container.Now}).Revoke(ctx, tx, *row.StrikeID, "Appeal overturned: "+reason); err != nil {
			return err
		}
		applied.strikeRevoked = true
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "strike.appealDecided", row.StrikeID.String(), now, map[string]string{"strikeId": row.StrikeID.String(), "accountId": row.AppellantID.String(), "outcome": string(outcome), "reason": reason})
}

func (handler Handler) restoreTarget(ctx context.Context, tx *ent.Tx, row *ent.Appeal, outcome appeal.Status, reason string, now time.Time, applied *effects) error {
	if outcome != appeal.StatusOverturned || row.ReportID == nil || !restoresContent[row.DecisionType] {
		return nil
	}
	report, err := tx.ContentReport.Query().Where(contentreport.ID(*row.ReportID)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	applied.visibilityBefore, applied.visibilityAfter = string(report.Visibility), string(report.Visibility)
	if report.Visibility == contentreport.VisibilityVisible {
		return nil
	}
	if err := tx.ContentReport.UpdateOne(report).SetVisibility(contentreport.VisibilityVisible).Exec(ctx); err != nil {
		return err
	}
	applied.visibilityAfter = "visible"
	owner := ""
	if report.AuthorID != nil {
		owner = report.AuthorID.String()
	}
	return reportservices.PublishVisibilityChange(ctx, tx, string(report.TargetType), report.TargetID, owner, "visible", "appeal", row.ID.String(), "Appeal overturned: "+reason, now)
}

func (handler Handler) audit(ctx context.Context, command Command, row *ent.Appeal, outcome appeal.Status, reason string, applied effects) error {
	before, _ := json.Marshal(map[string]any{"status": row.Status, "targetVisibility": applied.visibilityBefore})
	after, _ := json.Marshal(map[string]any{"status": outcome, "targetVisibility": applied.visibilityAfter, "strikeRevoked": applied.strikeRevoked, "suspensionLifted": applied.suspensionLifted})
	return handler.Container.Audit.Record(ctx, integrations.AuditRecord{
		ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "appeal." + string(outcome), SubjectType: "appeal", SubjectId: row.ID.String(), SubjectLabel: string(row.DecisionType),
		Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUpVerified: command.Staff.SteppedUp,
	})
}
