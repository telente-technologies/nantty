package movecategory

import (
	"context"
	"slices"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	categoryservices "nantty/modules/catalog/src/modules/adminCategories/services"
	"nantty/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (any, error) {
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := categoryservices.FindPlatformCategory(ctx, tx.Client(), command.CategoryId)
		if ent.IsNotFound(err) {
			return catalogerrors.NotFound
		}
		if err != nil {
			return err
		}
		siblings := tx.Category.Query().Where(category.StoreIDIsNil())
		if row.ParentID == nil {
			siblings = siblings.Where(category.ParentIDIsNil())
		} else {
			siblings = siblings.Where(category.ParentID(*row.ParentID))
		}
		ordered, err := siblings.Order(ent.Asc(category.FieldSortOrder), ent.Asc(category.FieldName)).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		index := slices.IndexFunc(ordered, func(candidate *ent.Category) bool { return candidate.ID == row.ID })
		target := index - 1
		if command.Direction == "down" {
			target = index + 1
		}
		if target < 0 || target >= len(ordered) {
			return catalogerrors.CannotMove
		}
		ordered[index], ordered[target] = ordered[target], ordered[index]
		for position, sibling := range ordered {
			if sibling.SortOrder != position {
				if err := tx.Category.UpdateOneID(sibling.ID).SetSortOrder(position).Exec(ctx); err != nil {
					return err
				}
			}
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: "catalog.category_reordered", SubjectType: categoryservices.SubjectType, SubjectId: row.ID.String(), SubjectLabel: row.Name,
			Before: map[string]int{"sortOrder": index}, After: map[string]int{"sortOrder": target},
		})
	})
	if err != nil {
		return nil, err
	}
	views, err := categoryservices.PresentAll(ctx, handler.Container)
	return map[string]any{"items": views}, err
}
