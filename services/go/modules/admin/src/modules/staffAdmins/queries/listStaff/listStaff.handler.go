package liststaff

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/predicate"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/modules/staffAdmins/services"
)

const pageSize = 25

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	var predicates []predicate.StaffAccount
	if query.Cursor != "" {
		cursorId, err := uuid.Parse(query.Cursor)
		if err != nil {
			return Result{}, adminerrors.Unprocessable("The cursor is invalid.")
		}
		predicates = append(predicates, staffaccount.IDLT(cursorId))
	}
	if search := strings.TrimSpace(query.Search); search != "" {
		predicates = append(predicates, staffaccount.Or(staffaccount.EmailContainsFold(search), staffaccount.DisplayNameContainsFold(search)))
	}
	if query.Status != "" {
		predicates = append(predicates, staffaccount.StatusEQ(staffaccount.Status(strings.ToLower(query.Status))))
	}
	if query.Role != "" {
		predicates = append(predicates, staffaccount.RoleEQ(staffaccount.Role(strings.ToLower(query.Role))))
	}
	rows, err := handler.Container.Client.StaffAccount.Query().Where(predicates...).Order(ent.Desc(staffaccount.FieldID)).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		result.NextCursor = &next
	}
	result.Data, err = services.BuildStaffViews(ctx, handler.Container.Client, rows)
	return result, err
}
