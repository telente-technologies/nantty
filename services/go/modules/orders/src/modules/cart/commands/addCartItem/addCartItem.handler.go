package addcartitem

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/cart"
	"nantty/modules/orders/src/generated/ent/cartitem"
	"nantty/modules/orders/src/modules/cart/dtos"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
	"nantty/platform/commerceports"
)

const maximumQuantityPerLine = 99

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.CartView, error) {
	snapshot, err := handler.resolveVariant(ctx, command)
	if err != nil {
		return types.CartView{}, err
	}
	if !snapshot.Purchasable {
		return types.CartView{}, ordererrors.ProductUnavailable
	}
	if snapshot.SellerAccountId == command.AccountId {
		return types.CartView{}, ordererrors.CannotBuyOwnProduct
	}
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		cartId, err := ensureCart(ctx, tx, command.AccountId)
		if err != nil {
			return err
		}
		existing, err := tx.CartItem.Query().Where(cartitem.CartID(cartId), cartitem.VariantID(snapshot.VariantId)).ForUpdate().Only(ctx)
		quantity := command.Request.Quantity
		if err == nil {
			quantity += existing.Quantity
		} else if !ent.IsNotFound(err) {
			return err
		}
		quantity = min(quantity, maximumQuantityPerLine)
		if err := handler.checkStock(ctx, snapshot, quantity); err != nil {
			return err
		}
		source, attributionId := attributionOf(command.Request.Attribution)
		if existing != nil {
			update := existing.Update().SetQuantity(quantity)
			sameAttribution := existing.AttributionSource != nil && source != nil && *existing.AttributionSource == *source && *existing.AttributionID == *attributionId
			if source != nil && (existing.AttributionSource == nil || sameAttribution) {
				update.SetAttributionSource(*source).SetAttributionID(*attributionId).SetAttributedAt(handler.Container.Now())
			}
			return update.Exec(ctx)
		}
		return tx.CartItem.Create().SetCartID(cartId).SetProductID(snapshot.ProductId).SetVariantID(snapshot.VariantId).SetStoreID(snapshot.StoreId).SetQuantity(quantity).
			SetNillableAttributionSource(source).SetNillableAttributionID(attributionId).SetNillableAttributedAt(attributedAtWhen(source, handler.Container.Now())).Exec(ctx)
	})
	if err != nil {
		return types.CartView{}, err
	}
	return services.BuildCartView(ctx, handler.Container, command.AccountId, nil)
}

func attributionOf(attribution *dtos.SaleAttribution) (*string, *uuid.UUID) {
	if attribution == nil {
		return nil, nil
	}
	identifier := uuid.MustParse(attribution.Id)
	return &attribution.Source, &identifier
}

func attributedAtWhen(source *string, now time.Time) *time.Time {
	if source == nil {
		return nil
	}
	return &now
}

func ensureCart(ctx context.Context, tx *ent.Tx, accountId uuid.UUID) (uuid.UUID, error) {
	if err := tx.Cart.Create().SetAccountID(accountId).OnConflictColumns(cart.FieldAccountID).DoNothing().Exec(ctx); err != nil && !isNoRows(err) {
		return uuid.Nil, err
	}
	row, err := tx.Cart.Query().Where(cart.AccountID(accountId)).Only(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	return row.ID, nil
}

func (handler Handler) checkStock(ctx context.Context, snapshot commerceports.ProductSnapshot, quantity int) error {
	if !snapshot.TrackInventory {
		return nil
	}
	stock, err := handler.Container.Stock()
	if err != nil {
		return err
	}
	available, err := stock.AvailableByVariant(ctx, []uuid.UUID{snapshot.VariantId})
	if err != nil {
		return err
	}
	if available[snapshot.VariantId] < quantity {
		return ordererrors.InsufficientStock
	}
	return nil
}

func (handler Handler) resolveVariant(ctx context.Context, command Command) (commerceports.ProductSnapshot, error) {
	catalog, err := handler.Container.Catalog()
	if err != nil {
		return commerceports.ProductSnapshot{}, err
	}
	variants, err := catalog.ListVariantsOfProduct(ctx, uuid.MustParse(command.Request.ProductId))
	if err != nil {
		return commerceports.ProductSnapshot{}, err
	}
	if len(variants) == 0 {
		return commerceports.ProductSnapshot{}, ordererrors.VariantNotFound
	}
	matches := []commerceports.ProductSnapshot{}
	for _, variant := range variants {
		if matchesRequest(variant, command.Request.VariantId, command.Request.Size, command.Request.Color, command.Request.Options) {
			matches = append(matches, variant)
		}
	}
	switch {
	case len(matches) == 1:
		return matches[0], nil
	case len(matches) == 0:
		return commerceports.ProductSnapshot{}, ordererrors.VariantNotFound
	}
	return commerceports.ProductSnapshot{}, ordererrors.VariantRequired
}

func matchesRequest(variant commerceports.ProductSnapshot, variantId, size, color *string, options map[string]string) bool {
	if variantId != nil {
		return variant.VariantId.String() == *variantId
	}
	if size != nil && !strings.EqualFold(variant.Size, *size) {
		return false
	}
	if color != nil && !strings.EqualFold(variant.Color, *color) {
		return false
	}
	for name, value := range options {
		actual, found := variant.OptionValues[name]
		if !found || !strings.EqualFold(actual, value) {
			return false
		}
	}
	return true
}
