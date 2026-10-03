package liststaff

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/types"
)

const pageSize = 25

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	request := handler.Container.Client.StaffAccount.Query().Order(ent.Desc(staffaccount.FieldID)).Limit(pageSize + 1)
	if query.Cursor != "" {
		cursorId, err := uuid.Parse(query.Cursor)
		if err != nil {
			return Result{}, adminerrors.Unprocessable("The cursor is invalid.")
		}
		request = request.Where(staffaccount.IDLT(cursorId))
	}
	rows, err := request.All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: make([]types.StaffView, 0, len(rows))}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		result.NextCursor = &next
	}
	for _, row := range rows {
		result.Data = append(result.Data, types.ConvertStaffToView(row))
	}
	return result, nil
}
