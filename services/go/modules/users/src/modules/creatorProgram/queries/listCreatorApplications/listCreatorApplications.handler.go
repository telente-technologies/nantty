package listcreatorapplications

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/creatorapplication"
	"nantty/modules/users/src/generated/ent/predicate"
	"nantty/modules/users/src/modules/creatorProgram/services"
)

const pageSize = 25

type Query struct {
	Status string
	Search string
	Cursor string
}

type Result struct {
	Data       []services.ProgramApplication `json:"data"`
	NextCursor *string                       `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	predicates := []predicate.CreatorApplication{}
	status := strings.ToLower(query.Status)
	if status == "" {
		status = "pending"
	}
	if status != "all" {
		predicates = append(predicates, creatorapplication.StatusEQ(creatorapplication.Status(status)))
	}
	if query.Cursor != "" {
		cursorId, err := uuid.Parse(query.Cursor)
		if err != nil {
			return Result{}, usersErrors.Unprocessable("The cursor is invalid.")
		}
		predicates = append(predicates, creatorapplication.IDGT(cursorId))
	}
	rows, err := handler.Container.Client.CreatorApplication.Query().Where(predicates...).Order(ent.Asc(creatorapplication.FieldID)).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: []services.ProgramApplication{}}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		result.NextCursor = &next
	}
	for _, row := range rows {
		view, err := services.BuildProgramApplication(ctx, handler.Container, row)
		if err != nil {
			return result, err
		}
		if search := strings.ToLower(strings.TrimPrefix(query.Search, "@")); search != "" && !strings.Contains(strings.ToLower(view.User.Username), search) && !strings.Contains(strings.ToLower(view.User.DisplayName), search) {
			continue
		}
		result.Data = append(result.Data, view)
	}
	return result, nil
}
