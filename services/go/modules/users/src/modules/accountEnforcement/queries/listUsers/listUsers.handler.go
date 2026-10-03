package listusers

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/predicate"
	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	"zudomart/platform/identityports"
)

const pageSize = 25

type Query struct {
	Search string
	Cursor string
}

type Result struct {
	Data       []services.PlatformUserSummary `json:"data"`
	NextCursor *string                        `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	predicates := []predicate.Profile{profile.KindEQ(profile.KindPersonal)}
	if search := strings.TrimSpace(strings.TrimPrefix(query.Search, "@")); search != "" {
		predicates = append(predicates, profile.Or(profile.HandleContainsFold(search), profile.DisplayNameContainsFold(search)))
	}
	if query.Cursor != "" {
		cursorId, err := uuid.Parse(query.Cursor)
		if err != nil {
			return Result{}, usersErrors.Unprocessable("The cursor is invalid.")
		}
		predicates = append(predicates, profile.IDLT(cursorId))
	}
	rows, err := handler.Container.Client.Profile.Query().Where(predicates...).Order(ent.Desc(profile.FieldID)).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: []services.PlatformUserSummary{}}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		result.NextCursor = &next
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return result, err
	}
	for _, row := range rows {
		account, found, err := directory.FindAccountSummary(ctx, row.AccountID)
		if err != nil || !found {
			if err != nil {
				return result, err
			}
			continue
		}
		summary, err := services.BuildPlatformUserSummary(ctx, handler.Container, services.Target{Account: account, Profile: row})
		if err != nil {
			return result, err
		}
		result.Data = append(result.Data, summary)
	}
	return result, nil
}
