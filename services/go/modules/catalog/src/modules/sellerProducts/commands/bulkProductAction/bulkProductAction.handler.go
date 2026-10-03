package bulkproductaction

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/category"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productmedia"
	"zudomart/modules/catalog/src/generated/ent/productvariant"
	"zudomart/modules/catalog/src/modules/sellerProducts/dtos"
	"zudomart/platform/money"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.BulkActionResult, error) {
	ids := make([]uuid.UUID, 0, len(command.Request.ProductIds))
	for _, raw := range command.Request.ProductIds {
		ids = append(ids, uuid.MustParse(raw))
	}
	updated := []string{}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		updated = updated[:0]
		products, err := tx.Product.Query().Where(product.StoreID(command.Store.StoreId), product.IDIn(ids...)).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		if command.Request.Action == "set_category" && command.Request.CategoryId != nil {
			found, err := tx.Category.Query().Where(category.ID(uuid.MustParse(*command.Request.CategoryId)), category.Or(category.StoreIDIsNil(), category.StoreID(command.Store.StoreId))).Exist(ctx)
			if err != nil || !found {
				if err == nil {
					err = catalogerrors.CategoryNotFound
				}
				return err
			}
		}
		for _, row := range products {
			changed, err := handler.applyToProduct(ctx, tx, row, command.Request)
			if err != nil {
				return err
			}
			if changed {
				updated = append(updated, row.ID.String())
			}
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "product.bulkUpdated", command.Store.StoreId.String(), handler.Container.Now(),
			map[string]any{"storeId": command.Store.StoreId, "action": command.Request.Action, "productIds": updated})
	})
	return dtos.BulkActionResult{UpdatedProductIds: updated}, err
}

func (handler Handler) applyToProduct(ctx context.Context, tx *ent.Tx, row *ent.Product, request dtos.BulkActionRequest) (bool, error) {
	switch request.Action {
	case "publish":
		hasImage, err := tx.ProductMedia.Query().Where(productmedia.ProductID(row.ID)).Exist(ctx)
		if err != nil || row.Status != enums.ProductActive || !hasImage {
			return false, err
		}
		update := row.Update().SetPublishedOnline(true)
		if row.PublishedAt == nil {
			update.SetPublishedAt(handler.Container.Now())
		}
		return true, update.Exec(ctx)
	case "unpublish":
		return true, row.Update().SetPublishedOnline(false).Exec(ctx)
	case "archive":
		return true, row.Update().SetStatus(enums.ProductArchived).SetPublishedOnline(false).ClearPublishAt().Exec(ctx)
	case "set_category":
		update := row.Update()
		if request.CategoryId == nil {
			update.ClearCategoryID()
		} else {
			update.SetCategoryID(uuid.MustParse(*request.CategoryId))
		}
		return true, update.Exec(ctx)
	case "set_visibility":
		return true, row.Update().SetVisibility(*request.Visibility).Exec(ctx)
	case "change_price_percent":
		return true, handler.changePrices(ctx, tx, row, *request.PricePercentBasisPoints)
	}
	return false, nil
}

func (handler Handler) changePrices(ctx context.Context, tx *ent.Tx, row *ent.Product, basisPoints int) error {
	variants, err := tx.ProductVariant.Query().Where(productvariant.ProductID(row.ID)).All(ctx)
	if err != nil {
		return err
	}
	minimum := int64(-1)
	for _, variant := range variants {
		repriced, err := money.Money{AmountMinor: variant.PriceMinor, Currency: money.CurrencyCode(row.Currency)}.ApplyBasisPointsRoundingHalfToEven(int64(10_000 + basisPoints))
		if err != nil {
			return err
		}
		update := variant.Update().SetPriceMinor(repriced.AmountMinor)
		if variant.CompareAtPriceMinor != nil && *variant.CompareAtPriceMinor <= repriced.AmountMinor {
			update.ClearCompareAtPriceMinor()
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		if minimum < 0 || repriced.AmountMinor < minimum {
			minimum = repriced.AmountMinor
		}
	}
	return row.Update().SetMinPriceMinor(max(minimum, 0)).Exec(ctx)
}
