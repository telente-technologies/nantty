package submitdecisionappeal

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/contentreport"
	"nantty/modules/moderation/src/generated/ent/strike"
	"nantty/modules/moderation/src/modules/appeals/services"
	"nantty/platform/httpserver"
)

const (
	AppealSubmittedType = "appeal.submitted"
	AppealWindow        = 30 * 24 * time.Hour
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	account, err := uuid.Parse(command.AccountId)
	if err != nil {
		return Result{}, httpserver.ErrUnauthorized
	}
	identifier, err := uuid.Parse(command.ReportId)
	if err != nil {
		return Result{}, httpserver.ErrNotFound
	}
	message := strings.TrimSpace(command.Message)
	if length := len([]rune(message)); length < 20 || length > 2000 {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "message", Message: "explain your appeal in 20 to 2000 characters"}})
	}
	report, err := handler.Container.Client.ContentReport.Query().Where(contentreport.ID(identifier), contentreport.AuthorID(account), contentreport.StatusEQ(contentreport.StatusResolved)).Only(ctx)
	if ent.IsNotFound(err) {
		return Result{}, httpserver.ErrNotFound
	}
	if err != nil {
		return Result{}, err
	}
	decision, found := services.ReportDecision(report)
	if !found || !services.IsAppealableAction(decision.Action) {
		return Result{}, httpserver.NewApiError(http.StatusUnprocessableEntity, "NOT_APPEALABLE", "There is nothing to appeal on this decision.")
	}
	now := handler.Container.Now()
	if decidedAt, err := time.Parse(time.RFC3339, decision.DecidedAt); err == nil && now.Sub(decidedAt) > AppealWindow {
		return Result{}, httpserver.NewApiError(http.StatusConflict, "APPEAL_WINDOW_CLOSED", "Decisions can be appealed for 30 days.")
	}
	var result Result
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		linked, err := tx.Strike.Query().Where(strike.AccountID(account), strike.ReferenceType("content_report"), strike.ReferenceID(report.ID.String())).Order(ent.Desc(strike.FieldCreatedAt)).First(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		if linked != nil {
			if linked.AppealStatus != strike.AppealStatusNone {
				return alreadyAppealed()
			}
			if err := tx.Strike.UpdateOne(linked).SetAppealStatus(strike.AppealStatusPending).SetAppealMessage(message).SetAppealedAt(now).Exec(ctx); err != nil {
				return err
			}
		}
		created, err := services.OpenForReport(ctx, tx, report, account, linked, message, now)
		if ent.IsConstraintError(err) {
			return alreadyAppealed()
		}
		if err != nil {
			return err
		}
		result = Result{Status: "received", AppealId: created.ID.String()}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, AppealSubmittedType, created.ID.String(), now, map[string]string{"appealId": created.ID.String(), "accountId": account.String(), "decisionType": string(created.DecisionType)})
	})
	return result, err
}

func alreadyAppealed() error {
	return httpserver.NewApiError(http.StatusConflict, "ALREADY_APPEALED", "You already appealed this decision.")
}
