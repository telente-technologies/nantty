package listcurrentpolicyversions

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/legal/services"
)

type Item struct {
	PolicyVersionId  string `json:"policyVersionId"`
	DocumentKey      string `json:"documentKey"`
	Title            string `json:"title"`
	VersionLabel     string `json:"versionLabel"`
	Summary          string `json:"summary"`
	PublishedAt      string `json:"publishedAt"`
	EffectiveAt      string `json:"effectiveAt"`
	IsMaterialChange bool   `json:"isMaterialChange"`
	DocumentUrl      string `json:"documentUrl"`
}

type Result struct {
	Items      []Item  `json:"items"`
	Data       []Item  `json:"data"`
	NextCursor *string `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context) (Result, error) {
	result := Result{Items: []Item{}}
	for _, definition := range services.DocumentDefinitions {
		version, err := services.CurrentPublishedVersion(ctx, handler.Container.Client, definition.Key)
		if err != nil {
			return result, err
		}
		if version == nil {
			continue
		}
		item := Item{PolicyVersionId: version.ID.String(), DocumentKey: definition.Key, Title: definition.Title, VersionLabel: "v" + services.VersionNumberText(version.VersionNumber), Summary: version.ChangeSummary,
			EffectiveAt: version.EffectiveAt.UTC().Format(time.RFC3339), IsMaterialChange: version.IsMaterialChange, DocumentUrl: definition.PublicPath}
		if version.PublishedAt != nil {
			item.PublishedAt = version.PublishedAt.UTC().Format(time.RFC3339)
		}
		result.Items = append(result.Items, item)
	}
	result.Data = result.Items
	return result, nil
}

func (handler Handler) AcceptedBy(ctx context.Context, accountId string) ([]string, error) {
	owner, err := uuid.Parse(accountId)
	if err != nil {
		return []string{}, nil
	}
	return services.AcceptedPolicyVersionIds(ctx, handler.Container.Client, owner)
}
