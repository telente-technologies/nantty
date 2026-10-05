package updatecategory

import (
	"context"
	"strings"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/category"
	createcategory "zudomart/modules/catalog/src/modules/adminCategories/commands/createCategory"
	categoryservices "zudomart/modules/catalog/src/modules/adminCategories/services"
	"zudomart/modules/catalog/src/modules/adminCategories/validators"
	"zudomart/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

type editable struct {
	Name     string  `json:"name"`
	Slug     string  `json:"slug"`
	ParentId *string `json:"parentId"`
	IconName *string `json:"iconName"`
}

func snapshot(row *ent.Category) editable {
	view := categoryservices.Present(row, 0)
	return editable{Name: view.Name, Slug: view.Slug, ParentId: view.ParentId, IconName: view.IconName}
}

func (handler Handler) Execute(ctx context.Context, command Command) (any, error) {
	request := command.Request
	var updated *ent.Category
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := categoryservices.FindPlatformCategory(ctx, tx.Client(), command.CategoryId)
		if ent.IsNotFound(err) {
			return catalogerrors.NotFound
		}
		if err != nil {
			return err
		}
		before, after := snapshot(row), snapshot(row)
		if request.Name != nil {
			after.Name = strings.TrimSpace(*request.Name)
		}
		if slug := validators.Trimmed(request.Slug); slug != nil {
			after.Slug = *slug
		}
		if request.IconName.Present {
			after.IconName = validators.Trimmed(request.IconName.Value)
		}
		if request.ParentId.Present {
			after.ParentId = validators.Trimmed(request.ParentId.Value)
		}
		moved := !sameOptional(before.ParentId, after.ParentId)
		if before.Name == after.Name && before.Slug == after.Slug && sameOptional(before.IconName, after.IconName) && !moved {
			return catalogerrors.NoChange
		}
		if after.Slug != before.Slug {
			if err := createcategory.EnsureSlugFree(ctx, tx.Client(), after.Slug, &row.ID); err != nil {
				return err
			}
		}
		change := row.Update().SetName(after.Name).SetSlug(after.Slug)
		if after.IconName == nil {
			change.ClearIconName()
		} else {
			change.SetIconName(*after.IconName)
		}
		if moved {
			if err := applyMove(ctx, tx, row, after.ParentId, change); err != nil {
				return err
			}
		}
		if updated, err = change.Save(ctx); err != nil {
			return err
		}
		action := "catalog.category_updated"
		if moved {
			action = "catalog.category_moved"
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: action, SubjectType: categoryservices.SubjectType, SubjectId: row.ID.String(), SubjectLabel: after.Name, Reason: request.Reason, Before: before, After: after,
		})
	})
	if err != nil {
		return nil, err
	}
	view, err := categoryservices.PresentOne(ctx, handler.Container, updated)
	return map[string]any{"item": view}, err
}

func applyMove(ctx context.Context, tx *ent.Tx, row *ent.Category, parentId *string, change *ent.CategoryUpdateOne) error {
	parent, err := createcategory.ResolveParent(ctx, tx.Client(), parentId, row)
	if err != nil {
		return err
	}
	siblings := tx.Category.Query().Where(category.StoreIDIsNil(), category.IDNEQ(row.ID))
	if parent == nil {
		siblings = siblings.Where(category.ParentIDIsNil())
		change.ClearParentID().SetDepth(0).SetPath("/" + row.ID.String())
	} else {
		siblings = siblings.Where(category.ParentID(parent.ID))
		change.SetParentID(parent.ID).SetDepth(1).SetPath(parent.Path + "/" + row.ID.String())
	}
	count, err := siblings.Count(ctx)
	change.SetSortOrder(count)
	return err
}

func sameOptional(first, second *string) bool {
	if first == nil || second == nil {
		return first == nil && second == nil
	}
	return *first == *second
}
