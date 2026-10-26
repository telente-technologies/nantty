package listruleconflicts

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/linkedprofile"
	"nantty/modules/users/src/modules/linkedProfiles/services"
)

const pageLimit = 100

type Page struct {
	Data       []services.Summary `json:"data"`
	NextCursor *string            `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, after *uuid.UUID) (Page, error) {
	query := handler.Container.Client.LinkedProfile.Query().Where(linkedprofile.StatusEQ(linkedprofile.StatusHeld))
	if after != nil {
		query = query.Where(linkedprofile.AccountIDGT(*after))
	}
	accounts, err := query.Unique(true).Order(ent.Asc(linkedprofile.FieldAccountID)).Limit(pageLimit + 1).Select(linkedprofile.FieldAccountID).Strings(ctx)
	if err != nil {
		return Page{}, err
	}
	page := Page{Data: make([]services.Summary, 0, len(accounts))}
	if len(accounts) > pageLimit {
		accounts = accounts[:pageLimit]
		next := accounts[pageLimit-1]
		page.NextCursor = &next
	}
	for _, raw := range accounts {
		summary, err := services.BuildSummary(ctx, handler.Container, uuid.MustParse(raw))
		if err != nil {
			return Page{}, err
		}
		page.Data = append(page.Data, summary)
	}
	return page, nil
}
