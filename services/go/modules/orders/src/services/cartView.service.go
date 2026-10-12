package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/cart"
	"zudomart/modules/orders/src/generated/ent/cartitem"
	"zudomart/modules/orders/src/types"
	"zudomart/platform/commerceports"
	"zudomart/platform/money"
	"zudomart/platform/usersdirectory"
)

const (
	needsAddressMessage   = "Enter your delivery address to calculate shipping"
	notDeliverableMessage = "This seller does not currently ship to your selected location"
)

type CartContents struct {
	Cart  *ent.Cart
	Items []*ent.CartItem
}

func LoadCartContents(ctx context.Context, client *ent.Client, accountId uuid.UUID) (CartContents, error) {
	row, err := client.Cart.Query().Where(cart.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return CartContents{}, nil
	}
	if err != nil {
		return CartContents{}, err
	}
	items, err := client.CartItem.Query().Where(cartitem.CartID(row.ID)).Order(ent.Asc(cartitem.FieldID)).All(ctx)
	return CartContents{Cart: row, Items: items}, err
}

func PriceCartItems(ctx context.Context, deployed *container.Container, items []*ent.CartItem, country string) ([]PricedCartLine, map[uuid.UUID]bool, error) {
	catalog, err := deployed.Catalog()
	if err != nil {
		return nil, nil, err
	}
	variantIds := make([]uuid.UUID, 0, len(items))
	for _, item := range items {
		variantIds = append(variantIds, item.VariantID)
	}
	snapshots, err := catalog.ResolveProductsForCheckoutInCountry(ctx, variantIds, country)
	if err != nil {
		return nil, nil, err
	}
	lines := make([]PricedCartLine, 0, len(items))
	unavailable := map[uuid.UUID]bool{}
	for _, item := range items {
		snapshot, found := snapshots[item.VariantID]
		if !found {
			unavailable[item.ID] = true
			continue
		}
		if !snapshot.Purchasable {
			unavailable[item.ID] = true
		}
		lines = append(lines, PricedCartLine{ItemId: item.ID, Quantity: item.Quantity, Product: snapshot, AttributionSource: item.AttributionSource, AttributionId: item.AttributionID, AttributedAt: item.AttributedAt})
	}
	return lines, unavailable, nil
}

func BuildCartView(ctx context.Context, deployed *container.Container, accountId uuid.UUID, address *usersdirectory.ShippingAddress) (types.CartView, error) {
	contents, err := LoadCartContents(ctx, deployed.Client, accountId)
	view := types.CartView{Items: []types.CartItemView{}, Groups: []types.CartSellerGroupView{}}
	if err != nil || len(contents.Items) == 0 {
		return view, err
	}
	lines, unavailable, err := PriceCartItems(ctx, deployed, contents.Items, BuyerCountry(ctx, deployed, accountId, address))
	if err != nil {
		return view, err
	}
	groups, err := GroupCartLinesBySeller(lines)
	if err != nil {
		return view, err
	}
	storeIds := make([]uuid.UUID, 0, len(groups))
	for _, group := range groups {
		storeIds = append(storeIds, group.StoreId)
	}
	context, err := loadCartContext(ctx, deployed, accountId, storeIds, address)
	if err != nil {
		return view, err
	}
	context.available = markItemsWithoutEnoughStock(ctx, deployed, lines, unavailable)
	return assembleCartView(groups, unavailable, context, address), nil
}

func markItemsWithoutEnoughStock(ctx context.Context, deployed *container.Container, lines []PricedCartLine, unavailable map[uuid.UUID]bool) map[uuid.UUID]int {
	tracked := make([]uuid.UUID, 0, len(lines))
	for _, line := range lines {
		if line.Product.TrackInventory {
			tracked = append(tracked, line.Product.VariantId)
		}
	}
	stock, err := deployed.Stock()
	if err != nil || len(tracked) == 0 {
		return map[uuid.UUID]int{}
	}
	available, err := stock.AvailableByVariant(ctx, tracked)
	if err != nil {
		return map[uuid.UUID]int{}
	}
	for _, line := range lines {
		if line.Product.TrackInventory && available[line.Product.VariantId] < line.Quantity {
			unavailable[line.ItemId] = true
		}
	}
	return available
}

type cartContext struct {
	stores    map[uuid.UUID]commerceports.StoreSnapshot
	profiles  map[uuid.UUID]*ShippingProfileRules
	credits   map[uuid.UUID]CreditState
	rates     map[uuid.UUID]float64
	available map[uuid.UUID]int
}

func loadCartContext(ctx context.Context, deployed *container.Container, accountId uuid.UUID, storeIds []uuid.UUID, address *usersdirectory.ShippingAddress) (cartContext, error) {
	catalog, err := deployed.Catalog()
	if err != nil {
		return cartContext{}, err
	}
	loaded := cartContext{available: map[uuid.UUID]int{}}
	if loaded.stores, err = catalog.DescribeStores(ctx, storeIds); err != nil {
		return loaded, err
	}
	loaded.rates, _ = StoreSuccessRates(ctx, deployed, storeIds)
	if address != nil {
		if loaded.profiles, err = LoadShippingProfileRules(ctx, deployed, storeIds); err != nil {
			return loaded, err
		}
	}
	if loaded.credits, err = LoadCreditStatesForBuyer(ctx, deployed.Client, accountId, storeIds, deployed.Now()); err != nil {
		return loaded, err
	}
	return loaded, nil
}

func DeliveryLocationOf(address usersdirectory.ShippingAddress) DeliveryLocation {
	return DeliveryLocation{CountryCode: address.CountryCode, RegionId: address.RegionId, AdminAreaId: address.AdminAreaId}
}

func QuoteForGroup(group SellerGroup, profile *ShippingProfileRules, address *usersdirectory.ShippingAddress) (types.ShippingQuoteView, ShippingResult) {
	if address == nil {
		message := needsAddressMessage
		return types.ShippingQuoteView{Status: "needsAddress", Message: &message}, ShippingResult{}
	}
	result := CalculateShippingForOrderGroup(profile, DeliveryLocationOf(*address), group.SubtotalMinor)
	if result.Outcome == enums.ShippingNotDeliverable {
		message := notDeliverableMessage
		return types.ShippingQuoteView{Status: "notDeliverable", Message: &message}, result
	}
	fee := money.Money{AmountMinor: result.FeeMinor, Currency: group.Currency}
	quote := types.ShippingQuoteView{Status: "calculated", Fee: &fee, IsFree: result.FeeMinor == 0}
	if profile != nil && profile.FreeThresholdMinor != nil {
		quote.FreeThreshold = &money.Money{AmountMinor: *profile.FreeThresholdMinor, Currency: group.Currency}
	}
	if remaining := AmountToFreeShipping(result, profile, group.SubtotalMinor); remaining != nil {
		quote.AmountToFreeShipping = &money.Money{AmountMinor: *remaining, Currency: group.Currency}
	}
	return quote, result
}

func FindOwnedCartItem(ctx context.Context, client *ent.Client, accountId, itemId uuid.UUID) (*ent.CartItem, error) {
	item, err := client.CartItem.Get(ctx, itemId)
	if ent.IsNotFound(err) {
		return nil, ordererrors.CartItemNotFound
	}
	if err != nil {
		return nil, err
	}
	owned, err := client.Cart.Query().Where(cart.ID(item.CartID), cart.AccountID(accountId)).Exist(ctx)
	if err != nil || !owned {
		return nil, firstFailure(err, ordererrors.CartItemNotFound)
	}
	return item, nil
}

func firstFailure(primary, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}
