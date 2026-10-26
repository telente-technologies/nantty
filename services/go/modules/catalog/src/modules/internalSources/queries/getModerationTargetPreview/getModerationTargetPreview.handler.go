package getmoderationtargetpreview

import (
	"context"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/productmedia"
	"nantty/modules/catalog/src/modules/internalSources/dtos"
	"nantty/modules/catalog/src/modules/internalSources/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.ModerationTargetPreview, error) {
	if query.TargetType == "store" {
		return handler.previewStore(ctx, query)
	}
	row, err := handler.Container.Client.Product.Get(ctx, query.TargetId)
	if ent.IsNotFound(err) {
		return dtos.ModerationTargetPreview{}, catalogerrors.ProductNotFound
	}
	if err != nil {
		return dtos.ModerationTargetPreview{}, err
	}
	owner, err := handler.Container.Client.Store.Get(ctx, row.StoreID)
	if err != nil {
		return dtos.ModerationTargetPreview{}, err
	}
	urls, err := handler.Container.Client.ProductMedia.Query().Where(productmedia.ProductID(row.ID)).Order(ent.Asc(productmedia.FieldPosition)).Limit(10).Select(productmedia.FieldURL).Strings(ctx)
	if err != nil {
		return dtos.ModerationTargetPreview{}, err
	}
	return dtos.ModerationTargetPreview{OwnerId: owner.OwnerAccountID.String(), Title: &row.Name, Text: &row.Description, MediaUrls: urls, CreatedAt: services.Timestamp(row.CreatedAt)}, nil
}

func (handler Handler) previewStore(ctx context.Context, query Query) (dtos.ModerationTargetPreview, error) {
	row, err := handler.Container.Client.Store.Get(ctx, query.TargetId)
	if ent.IsNotFound(err) {
		return dtos.ModerationTargetPreview{}, catalogerrors.StoreNotFound
	}
	if err != nil {
		return dtos.ModerationTargetPreview{}, err
	}
	urls := []string{}
	for _, candidate := range []*string{row.LogoURL, row.BannerURL} {
		if candidate != nil && *candidate != "" {
			urls = append(urls, *candidate)
		}
	}
	return dtos.ModerationTargetPreview{OwnerId: row.OwnerAccountID.String(), Title: &row.Name, Text: &row.Description, MediaUrls: urls, CreatedAt: services.Timestamp(row.CreatedAt)}, nil
}
