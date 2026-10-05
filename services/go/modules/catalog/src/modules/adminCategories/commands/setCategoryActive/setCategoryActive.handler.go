package setcategoryactive

import (
	"context"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/category"
	categoryservices "zudomart/modules/catalog/src/modules/adminCategories/services"
	"zudomart/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (any, error) {
	var updated *ent.Category
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := categoryservices.FindPlatformCategory(ctx, tx.Client(), command.CategoryId)
		if ent.IsNotFound(err) {
			return catalogerrors.NotFound
		}
		if err != nil {
			return err
		}
		if row.Active == command.Active {
			return catalogerrors.NoChange
		}
		if updated, err = row.Update().SetActive(command.Active).Save(ctx); err != nil {
			return err
		}
		if !command.Active {
			if err := tx.Category.Update().Where(category.ParentID(row.ID)).SetActive(false).Exec(ctx); err != nil {
				return err
			}
		}
		action := "catalog.category_activated"
		if !command.Active {
			action = "catalog.category_deactivated"
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: action, SubjectType: categoryservices.SubjectType, SubjectId: row.ID.String(), SubjectLabel: row.Name, Reason: command.Reason,
			Before: map[string]bool{"isActive": row.Active}, After: map[string]bool{"isActive": command.Active},
		})
	})
	if err != nil {
		return nil, err
	}
	view, err := categoryservices.PresentOne(ctx, handler.Container, updated)
	return map[string]any{"item": view}, err
}
