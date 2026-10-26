package listadmincreatedaccounts

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/admincreatedaccount"
	"nantty/modules/users/src/modules/checkmarks/services"
)

const pageSize = 25

type Result struct {
	Data       []services.AdminCreatedAccountView `json:"data"`
	NextCursor *string                            `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, cursor string) (Result, error) {
	request := handler.Container.Client.AdminCreatedAccount.Query().Order(ent.Desc(admincreatedaccount.FieldID)).Limit(pageSize + 1)
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return Result{}, usersErrors.Unprocessable("The cursor is invalid.")
		}
		request = request.Where(admincreatedaccount.IDLT(cursorId))
	}
	rows, err := request.All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: []services.AdminCreatedAccountView{}}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		result.NextCursor = &next
	}
	for _, row := range rows {
		view, err := services.BuildAdminCreatedAccountView(ctx, handler.Container, row)
		if err != nil {
			return result, err
		}
		result.Data = append(result.Data, view)
	}
	return result, nil
}
