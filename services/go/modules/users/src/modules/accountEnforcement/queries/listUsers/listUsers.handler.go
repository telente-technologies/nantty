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

const (
	pageSize        = 25
	maximumScanned  = 500
	scanBatchLength = 100
)

type Query struct {
	Search       string
	Cursor       string
	Status       string
	Verification string
	Role         string
	Risk         string
}

type Result struct {
	Data       []services.PlatformUserSummary `json:"data"`
	NextCursor *string                        `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	predicates, err := buildFilterPredicates(query)
	if err != nil {
		return Result{}, err
	}
	predicates = append(predicates, profile.KindEQ(profile.KindPersonal))
	if search := strings.TrimSpace(strings.TrimPrefix(query.Search, "@")); search != "" {
		predicates = append(predicates, profile.Or(profile.HandleContainsFold(search), profile.DisplayNameContainsFold(search)))
	}
	var after *uuid.UUID
	if query.Cursor != "" {
		cursorId, err := uuid.Parse(query.Cursor)
		if err != nil {
			return Result{}, usersErrors.Unprocessable("The cursor is invalid.")
		}
		after = &cursorId
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: []services.PlatformUserSummary{}}
	for scanned := 0; scanned < maximumScanned && len(result.Data) < pageSize; {
		batch := append([]predicate.Profile{}, predicates...)
		if after != nil {
			batch = append(batch, profile.IDLT(*after))
		}
		rows, err := handler.Container.Client.Profile.Query().Where(batch...).Order(ent.Desc(profile.FieldID)).Limit(scanBatchLength).All(ctx)
		if err != nil {
			return result, err
		}
		for index, row := range rows {
			scanned++
			after = &rows[index].ID
			account, found, err := directory.FindAccountSummary(ctx, row.AccountID)
			if err != nil {
				return result, err
			}
			if !found {
				continue
			}
			summary, err := services.BuildPlatformUserSummary(ctx, handler.Container, services.Target{Account: account, Profile: row})
			if err != nil {
				return result, err
			}
			if matchesAccountFilters(query, summary) {
				result.Data = append(result.Data, summary)
			}
			if len(result.Data) == pageSize || scanned == maximumScanned {
				break
			}
		}
		if len(rows) < scanBatchLength && (len(result.Data) < pageSize && scanned < maximumScanned) {
			return result, nil
		}
		if len(rows) == 0 {
			return result, nil
		}
	}
	next := after.String()
	result.NextCursor = &next
	return result, nil
}
