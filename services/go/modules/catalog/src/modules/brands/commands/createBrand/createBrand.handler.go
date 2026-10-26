package createbrand

import (
	"context"
	"log/slog"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/databases/schema"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/brand"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/interfaces"
	brandservices "nantty/modules/catalog/src/modules/brands/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (brandservices.BrandDetail, error) {
	request := command.Request
	scope := "brands.create:" + command.AccountId.String()
	hash := container.FingerprintOfRequest(request)
	var claimed *uuid.UUID
	brandId, err := container.RunIdempotently(ctx, handler.Container, scope, command.IdempotencyKey, hash, func(tx *ent.Tx) (string, error) {
		handle := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(request.Handle), "@"))
		taken, err := tx.Brand.Query().Where(brand.Slug(handle)).Exist(ctx)
		if err != nil {
			return "", err
		}
		if taken {
			return "", catalogerrors.BrandHandleTaken
		}
		owned, err := tx.Brand.Query().Where(brand.OwnerAccountID(command.AccountId), brand.Active(true)).Exist(ctx)
		if err != nil {
			return "", err
		}
		if owned {
			return "", catalogerrors.ProfileLimitOneBrand
		}
		categoryId := uuid.MustParse(request.CategoryId)
		brandId := schema.NewTimeOrderedUuid()
		if err := handler.Container.LinkedProfiles.Claim(ctx, command.AccountId, interfaces.LinkedClaim{Kind: "brand", ProfileId: brandId}); err != nil {
			return "", err
		}
		claimed = &brandId
		created, err := tx.Brand.Create().SetID(brandId).SetName(strings.TrimSpace(request.Name)).SetSlug(handle).SetNillableLogoURL(blankToNil(request.LogoUrl)).
			SetNillableCoverURL(blankToNil(request.CoverUrl)).SetNillableWebsite(blankToNil(request.Website)).SetDescription(strings.TrimSpace(request.Description)).
			SetCategoryID(categoryId).SetCategoryName(handler.categoryName(ctx, categoryId)).SetOwnerAccountID(command.AccountId).Save(ctx)
		if err != nil {
			return "", err
		}
		return created.ID.String(), events.EnqueueOutboxEventInTransaction(ctx, tx, "brand.updated", created.ID.String(), handler.Container.Now(), map[string]any{"brandId": created.ID})
	})
	if err != nil && claimed != nil {
		if releaseErr := handler.Container.LinkedProfiles.Release(ctx, command.AccountId, interfaces.LinkedClaim{Kind: "brand", ProfileId: *claimed}); releaseErr != nil {
			handler.Container.Logger.Error("release linked brand claim", slog.Any("error", releaseErr))
		}
	}
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
