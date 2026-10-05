package createbrand

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/brand"
	"zudomart/modules/catalog/src/generated/ent/category"
	brandservices "zudomart/modules/catalog/src/modules/brands/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (brandservices.BrandDetail, error) {
	request := command.Request
	scope := "brands.create:" + command.AccountId.String()
	hash := container.FingerprintOfRequest(request)
	brandId, err := container.RunIdempotently(ctx, handler.Container, scope, command.IdempotencyKey, hash, func(tx *ent.Tx) (string, error) {
		handle := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(request.Handle), "@"))
		taken, err := tx.Brand.Query().Where(brand.Slug(handle)).Exist(ctx)
		if err != nil {
			return "", err
		}
		if taken {
			return "", catalogerrors.BrandHandleTaken
		}
		categoryId := uuid.MustParse(request.CategoryId)
		created, err := tx.Brand.Create().SetName(strings.TrimSpace(request.Name)).SetSlug(handle).SetNillableLogoURL(blankToNil(request.LogoUrl)).
			SetNillableCoverURL(blankToNil(request.CoverUrl)).SetNillableWebsite(blankToNil(request.Website)).SetDescription(strings.TrimSpace(request.Description)).
			SetCategoryID(categoryId).SetCategoryName(handler.categoryName(ctx, categoryId)).SetOwnerAccountID(command.AccountId).Save(ctx)
		if err != nil {
			return "", err
		}
		return created.ID.String(), events.EnqueueOutboxEventInTransaction(ctx, tx, "brand.updated", created.ID.String(), handler.Container.Now(), map[string]any{"brandId": created.ID})
	})
	if ent.IsConstraintError(err) {
		return brandservices.BrandDetail{}, catalogerrors.BrandHandleTaken
	}
	if err != nil {
		return brandservices.BrandDetail{}, err
	}
	row, err := handler.Container.Client.Brand.Get(ctx, uuid.MustParse(brandId))
	if err != nil {
		return brandservices.BrandDetail{}, err
	}
	return brandservices.Detail(ctx, handler.Container, row, &command.AccountId)
}

func (handler Handler) categoryName(ctx context.Context, categoryId uuid.UUID) string {
	if row, err := handler.Container.Client.Category.Query().Where(category.ID(categoryId), category.StoreIDIsNil()).Only(ctx); err == nil {
		return row.Name
	}
	var name string
	if handler.Container.Database != nil {
		_ = handler.Container.Database.QueryRowContext(ctx, "SELECT name FROM users.business_categories WHERE id = $1", categoryId).Scan(&name)
	}
	return name
}

func blankToNil(value *string) *string {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}
