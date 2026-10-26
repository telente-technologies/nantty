package createcategory

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	categoryservices "nantty/modules/catalog/src/modules/adminCategories/services"
	"nantty/modules/catalog/src/modules/adminCategories/validators"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/utils"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (any, error) {
	request := command.Request
	name := strings.TrimSpace(request.Name)
	slug := services.Slugify(name)
	if explicit := validators.Trimmed(request.Slug); explicit != nil {
		slug = *explicit
	}
	var created *ent.Category
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		parent, err := ResolveParent(ctx, tx.Client(), request.ParentId, nil)
		if err != nil {
			return err
		}
		if err := EnsureSlugFree(ctx, tx.Client(), slug, nil); err != nil {
			return err
		}
		siblings := tx.Category.Query().Where(category.StoreIDIsNil())
		depth := 0
		if parent != nil {
			siblings, depth = siblings.Where(category.ParentID(parent.ID)), 1
		} else {
			siblings = siblings.Where(category.ParentIDIsNil())
		}
		count, err := siblings.Count(ctx)
		if err != nil {
			return err
		}
		create := tx.Category.Create().SetName(name).SetSlug(slug).SetDepth(depth).SetSortOrder(count).SetNillableIconName(validators.Trimmed(request.IconName))
		if parent != nil {
			create.SetParentID(parent.ID)
		}
		if created, err = create.Save(ctx); err != nil {
			return err
		}
		path := "/" + created.ID.String()
		if parent != nil {
			path = parent.Path + path
		}
		if created, err = created.Update().SetPath(path).Save(ctx); err != nil {
			return err
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: "catalog.category_created", SubjectType: categoryservices.SubjectType, SubjectId: created.ID.String(), SubjectLabel: created.Name,
			Reason: request.Reason, After: categoryservices.Present(created, 0),
		})
	})
	if err != nil {
		return nil, err
	}
	view, err := categoryservices.PresentOne(ctx, handler.Container, created)
	return map[string]any{"item": view}, err
}

func ResolveParent(ctx context.Context, client *ent.Client, raw *string, moving *ent.Category) (*ent.Category, error) {
	if raw == nil || *raw == "" {
		return nil, nil
	}
	parentId, _ := uuid.Parse(*raw)
	issues := utils.Issues{}
	parent, err := categoryservices.FindPlatformCategory(ctx, client, parentId)
	switch {
	case ent.IsNotFound(err):
		issues.Add("parentId", "Choose an existing top-level category.")
	case err != nil:
		return nil, err
	case parent.ParentID != nil:
		issues.Add("parentId", "Categories can only be two levels deep. Choose a top-level parent.")
	case moving != nil && parent.ID == moving.ID:
		issues.Add("parentId", "A category cannot be its own parent.")
	}
	if moving != nil && len(issues) == 0 {
		hasChildren, err := client.Category.Query().Where(category.ParentID(moving.ID)).Exist(ctx)
		if err != nil {
			return nil, err
		}
		if hasChildren {
			issues.Add("parentId", "Move or remove this category's subcategories first.")
		}
	}
	return parent, issues.AsError()
}

func EnsureSlugFree(ctx context.Context, client *ent.Client, slug string, except *uuid.UUID) error {
	query := client.Category.Query().Where(category.StoreIDIsNil(), category.Slug(slug))
	if except != nil {
		query = query.Where(category.IDNEQ(*except))
	}
	taken, err := query.Exist(ctx)
	if err == nil && taken {
		return catalogerrors.SlugTaken
	}
	return err
}
