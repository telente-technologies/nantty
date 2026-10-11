package listruleconflicts

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent/linkedprofile"
	"zudomart/modules/users/src/modules/linkedProfiles/services"
)

const pageLimit = 100

type Page struct {
	Data []services.Summary `json:"data"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context) (Page, error) {
	accounts, err := handler.Container.Client.LinkedProfile.Query().Where(linkedprofile.StatusEQ(linkedprofile.StatusHeld)).
		Unique(true).Limit(pageLimit).Select(linkedprofile.FieldAccountID).Strings(ctx)
	if err != nil {
		return Page{}, err
	}
	page := Page{Data: make([]services.Summary, 0, len(accounts))}
	for _, raw := range accounts {
		summary, err := services.BuildSummary(ctx, handler.Container, uuid.MustParse(raw))
		if err != nil {
			return Page{}, err
		}
		page.Data = append(page.Data, summary)
	}
	return page, nil
}
