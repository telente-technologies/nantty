package getcategory

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	categoryservices "nantty/modules/catalog/src/modules/adminCategories/services"
	"nantty/modules/catalog/src/services"
)

type Query struct {
	CategoryId uuid.UUID
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (any, error) {
	row, err := categoryservices.FindPlatformCategory(ctx, handler.Container.Client, query.CategoryId)
	if ent.IsNotFound(err) {
		return nil, catalogerrors.NotFound
	}
	if err != nil {
		return nil, err
	}
	view, err := categoryservices.PresentOne(ctx, handler.Container, row)
	return map[string]any{"item": view, "history": services.StaffHistory(ctx, handler.Container, categoryservices.SubjectType, row.ID.String())}, err
}
