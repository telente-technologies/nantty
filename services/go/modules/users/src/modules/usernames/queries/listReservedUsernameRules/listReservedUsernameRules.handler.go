package listreservedusernamerules

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/reservedusernamerule"
)

const pageSize = 50

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Page, error) {
	rules := handler.Container.Client.ReservedUsernameRule.Query().Order(ent.Desc(reservedusernamerule.FieldID)).Limit(pageSize + 1)
	if query.Cursor != "" {
		cursorId, err := uuid.Parse(query.Cursor)
		if err != nil {
			return Page{}, usersErrors.Unprocessable("The cursor is invalid.")
		}
		rules = rules.Where(reservedusernamerule.IDLT(cursorId))
	}
	rows, err := rules.All(ctx)
	if err != nil {
		return Page{}, err
	}
	page := Page{Data: make([]Rule, 0, len(rows))}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		page.NextCursor = &next
	}
	for _, row := range rows {
		page.Data = append(page.Data, Rule{Id: row.ID.String(), Term: row.Term, MatchKind: string(row.MatchKind), CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339)})
	}
	return page, nil
}
