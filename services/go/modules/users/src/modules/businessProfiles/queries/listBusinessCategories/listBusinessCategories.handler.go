package listbusinesscategories

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/businesscategory"
)

const pageSize = 200

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Page, error) {
	rows := handler.Container.Client.BusinessCategory.Query().Where(businesscategory.StatusEQ(businesscategory.StatusActive)).Order(ent.Asc(businesscategory.FieldID)).Limit(pageSize + 1)
	if query.Cursor != "" {
		cursorId, err := uuid.Parse(query.Cursor)
		if err != nil {
			return Page{}, usersErrors.Unprocessable("The cursor is invalid.")
		}
		rows = rows.Where(businesscategory.IDGT(cursorId))
	}
	found, err := rows.All(ctx)
	if err != nil {
		return Page{}, err
	}
	page := Page{Data: make([]Category, 0, len(found))}
	if len(found) > pageSize {
		found = found[:pageSize]
		next := found[len(found)-1].ID.String()
		page.NextCursor = &next
	}
	for _, row := range found {
		category := Category{Id: row.ID.String(), Kind: "business", Name: row.Name, Slug: row.Slug, Active: true}
		if row.ParentID != nil {
			parent := row.ParentID.String()
			category.ParentId = &parent
		}
		page.Data = append(page.Data, category)
	}
	return page, nil
}
