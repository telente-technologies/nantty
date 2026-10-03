package issuestrike

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/modules/strikes/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func invalid(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	account, err := uuid.Parse(command.AccountId)
	if err != nil {
		return Result{}, invalid("accountId", "must be an account id")
	}
	if command.Kind == "" {
		command.Kind = "strike"
	}
	if command.Source == "" {
		command.Source = "manual"
	}
	reason, policy := strings.TrimSpace(command.Reason), strings.TrimSpace(command.Policy)
	switch {
	case !slices.Contains([]string{"warning", "strike"}, command.Kind):
		return Result{}, invalid("kind", "must be warning or strike")
	case !slices.Contains([]string{"moderation", "copyright", "manual", "ip_claim"}, command.Source):
		return Result{}, invalid("source", "is not a known strike source")
	case len(reason) < 5 || len(reason) > 1000:
		return Result{}, invalid("reason", "must be 5 to 1000 characters")
	case policy == "" || len(policy) > 120:
		return Result{}, invalid("policy", "is required and at most 120 characters")
	case command.ExpiresInDays < 0 || command.ExpiresInDays > 3650:
		return Result{}, invalid("expiresInDays", "must be 0 to 3650")
	}
	var issued *ent.Strike
	var created bool
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var issueErr error
		issued, created, issueErr = services.Recorder{Now: handler.Container.Now}.Issue(ctx, tx, services.IssueParams{
			AccountId: account, Kind: command.Kind, Policy: policy, Reason: reason, Source: command.Source, IssuedById: command.IssuedById, IssuedByName: command.IssuedByName,
			ReferenceType: command.ReferenceType, ReferenceId: command.ReferenceId, ExpiresInDays: command.ExpiresInDays,
		})
		return issueErr
	})
	if err != nil {
		return Result{}, err
	}
	counts, err := services.ActiveCounts(ctx, handler.Container.Client, handler.Container.Now(), []uuid.UUID{account})
	if err != nil {
		return Result{}, err
	}
	active := counts[account].ActiveStrikes
	return Result{Id: issued.ID.String(), Created: created, ActiveStrikeCount: active, IsRepeatInfringer: services.IsRepeatInfringer(active)}, nil
}
