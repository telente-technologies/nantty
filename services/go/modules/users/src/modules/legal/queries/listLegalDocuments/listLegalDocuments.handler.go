package listlegaldocuments

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent/legalversion"
	"nantty/modules/users/src/modules/legal/services"
)

type DocumentSummary struct {
	Key            string                `json:"key"`
	Title          string                `json:"title"`
	PublicPath     string                `json:"publicPath"`
	CurrentVersion *services.VersionView `json:"currentVersion"`
	OpenVersion    *services.VersionView `json:"openVersion"`
	VersionCount   int                   `json:"versionCount"`
}

type Result struct {
	Items      []DocumentSummary `json:"items"`
	Data       []DocumentSummary `json:"data"`
	NextCursor *string           `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func Summarize(ctx context.Context, application *container.Container, definition services.DocumentDefinition) (DocumentSummary, error) {
	summary := DocumentSummary{Key: definition.Key, Title: definition.Title, PublicPath: definition.PublicPath}
	current, err := services.CurrentPublishedVersion(ctx, application.Client, definition.Key)
	if err != nil {
		return summary, err
	}
	if current != nil {
		view := services.ConvertVersionToView(current)
		summary.CurrentVersion = &view
	}
	open, err := application.Client.LegalVersion.Query().Where(legalversion.DocumentKey(definition.Key), legalversion.StatusIn(legalversion.StatusDraft, legalversion.StatusInReview)).First(ctx)
	if err == nil {
		view := services.ConvertVersionToView(open)
		summary.OpenVersion = &view
	}
	summary.VersionCount, err = application.Client.LegalVersion.Query().Where(legalversion.DocumentKey(definition.Key)).Count(ctx)
	return summary, err
}

func (handler Handler) Execute(ctx context.Context) (Result, error) {
	result := Result{Items: []DocumentSummary{}}
	for _, definition := range services.DocumentDefinitions {
		summary, err := Summarize(ctx, handler.Container, definition)
		if err != nil {
			return result, err
		}
		result.Items = append(result.Items, summary)
	}
	result.Data = result.Items
	return result, nil
}
