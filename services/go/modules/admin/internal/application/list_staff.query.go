package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/staffaccount"
)

const staffPageSize = 25

type StaffPage struct {
	Data       []StaffView `json:"data"`
	NextCursor *string     `json:"nextCursor"`
}

func (application *AdminApplication) ListStaffAccounts(ctx context.Context, cursor string) (StaffPage, error) {
	query := application.Client.StaffAccount.Query().Order(ent.Desc(staffaccount.FieldID)).Limit(staffPageSize + 1)
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return StaffPage{}, unprocessable("The cursor is invalid.")
		}
		query = query.Where(staffaccount.IDLT(cursorId))
	}
	rows, err := query.All(ctx)
	if err != nil {
		return StaffPage{}, err
	}
	page := StaffPage{Data: make([]StaffView, 0, len(rows))}
	if len(rows) > staffPageSize {
		rows = rows[:staffPageSize]
		next := rows[len(rows)-1].ID.String()
		page.NextCursor = &next
	}
	for _, row := range rows {
		page.Data = append(page.Data, ConvertStaffToView(row))
	}
	return page, nil
}
