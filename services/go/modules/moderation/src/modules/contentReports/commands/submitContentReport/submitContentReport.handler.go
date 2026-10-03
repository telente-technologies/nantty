package submitcontentreport

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/contentReports/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func invalid(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	reporter, err := uuid.Parse(command.ReporterId)
	if err != nil {
		return Result{}, invalid("reporterId", "must be a user id")
	}
	reason, known := services.NormalizeReason(command.Reason)
	switch {
	case !slices.Contains(services.ContentTargetTypes, command.TargetType):
		return Result{}, invalid("targetType", "must be post, comment, clip, live, product, store or sound")
	case !known:
		return Result{}, invalid("reason", "is not a known reason")
	case strings.TrimSpace(command.TargetId) == "" || len(command.TargetId) > 128 || len(command.Details) > 500:
		return Result{}, invalid("targetId", "is required; details are at most 500 characters")
	}
	outcome, err := services.Intake{Container: handler.Container}.Record(ctx, services.IntakeInput{
		TargetType: command.TargetType, TargetId: command.TargetId, Reason: reason, Details: command.Details, ReporterId: &reporter, Source: "user", SourceEventId: command.SourceEventId, AuthorHint: command.AuthorId,
	})
	if err != nil {
		return Result{}, err
	}
	return Result{Id: outcome.ReportId, Status: "received", Duplicate: outcome.Duplicate}, nil
}
