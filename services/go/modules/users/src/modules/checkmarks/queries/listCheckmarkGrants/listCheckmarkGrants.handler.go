package listcheckmarkgrants

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/checkmarkgrant"
	"nantty/modules/users/src/generated/ent/predicate"
	"nantty/modules/users/src/modules/checkmarks/services"
)

const pageSize = 25

type Result struct {
	Data       []services.GrantView `json:"data"`
	NextCursor *string              `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, status, cursor string) (Result, error) {
	var predicates []predicate.CheckmarkGrant
	switch strings.ToUpper(status) {
	case "REVOKED":
		predicates = append(predicates, checkmarkgrant.RevokedAtNotNil())
	case "ALL":
	default:
		predicates = append(predicates, checkmarkgrant.RevokedAtIsNil())
	}
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return Result{}, usersErrors.Unprocessable("The cursor is invalid.")
		}
		predicates = append(predicates, checkmarkgrant.IDLT(cursorId))
	}
	rows, err := handler.Container.Client.CheckmarkGrant.Query().Where(predicates...).Order(ent.Desc(checkmarkgrant.FieldID)).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: []services.GrantView{}}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		result.NextCursor = &next
	}
	for _, row := range rows {
		view, err := services.BuildGrantView(ctx, handler.Container, row)
		if err != nil {
			return result, err
		}
		result.Data = append(result.Data, view)
	}
	return result, nil
}
