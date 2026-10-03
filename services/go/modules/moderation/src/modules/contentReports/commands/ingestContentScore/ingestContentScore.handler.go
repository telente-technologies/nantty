package ingestcontentscore

import (
	"context"
	"slices"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/contentReports/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	if !command.AdvisoryOnly || command.ScoreId == "" || !slices.Contains(services.ContentTargetTypes, command.TargetType) || command.TargetId == "" || command.Score < 0 || command.Score > 1 {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "score", Message: "must be an advisory score between 0 and 1 for a known target"}})
	}
	action := services.ClassifierActionForScore(command.Score, command.SuggestedAction)
	if action == "allow" {
		return Result{Action: action}, nil
	}
	reason := "other"
	if top := topCategory(command.Categories); top != "" {
		reason = services.ReasonForClassifierCategory(top)
	}
	outcome, err := services.Intake{Container: handler.Container}.Record(ctx, services.IntakeInput{
		TargetType: command.TargetType, TargetId: command.TargetId, Reason: reason, Details: "Automated check (" + command.ModelVersion + ")", Source: "classifier", SourceEventId: "score:" + command.ScoreId,
		AuthorHint: command.OwnerId, ClassifierScores: command.scoresJson(), ClassifierAction: action,
	})
	return Result{Action: action, ReportId: outcome.ReportId}, err
}

func topCategory(categories []Category) string {
	best, name := -1.0, ""
	for _, category := range categories {
		if category.Score > best {
			best, name = category.Score, category.Category
		}
	}
	return name
}
