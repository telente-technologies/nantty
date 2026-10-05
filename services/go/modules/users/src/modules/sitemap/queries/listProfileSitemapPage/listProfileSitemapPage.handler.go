package listprofilesitemappage

import (
	"context"
	"time"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profile"
)

const PageSize = 1000

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	listed := handler.Container.Client.Profile.Query().Where(profile.KindEQ(profile.KindPersonal), profile.StatusEQ(profile.StatusActive), profile.IsPrivate(false))
	total, err := listed.Clone().Count(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Entries: []Entry{}, TotalPages: (total + PageSize - 1) / PageSize}
	if query.Page < 0 || query.Page >= result.TotalPages {
		return result, nil
	}
	rows, err := listed.Order(ent.Asc(profile.FieldID)).Offset(query.Page * PageSize).Limit(PageSize).All(ctx)
	for _, row := range rows {
		result.Entries = append(result.Entries, Entry{Id: row.AccountID.String(), Name: row.Handle, UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339)})
	}
	return result, err
}
