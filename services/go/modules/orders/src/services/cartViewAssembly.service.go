package services

import (
	"sort"

	"github.com/google/uuid"

	"nantty/modules/orders/src/types"
	"nantty/platform/money"
	"nantty/platform/usersdirectory"
)

func cartItemView(line PricedCartLine, unavailable map[uuid.UUID]bool) types.CartItemView {
	product := line.Product
	summary := types.ProductSummaryView{Id: product.ProductId.String(), Name: product.ProductTitle, Price: product.UnitPrice}
	if product.ImageUrl != "" {
		summary.ImageUrl = &product.ImageUrl
	}
	view := types.CartItemView{
		Id: line.ItemId.String(), Product: summary, Quantity: line.Quantity, StoreId: product.StoreId.String(), Available: !unavailable[line.ItemId],
		VariantDetail: &types.CartVariantView{Id: product.VariantId.String(), Size: product.Size, Color: product.Color, Sku: product.Sku, Title: product.VariantTitle},
	}
	if line.AttributionSource != nil && line.AttributionId != nil {
		view.Attribution = &types.SaleAttributionView{Source: *line.AttributionSource, Id: line.AttributionId.String()}
	}
	if product.VariantTitle != "" && product.VariantTitle != "Default" {
		title := product.VariantTitle
		view.Variant = &title
	}
	return view
}

func assembleCartView(groups []SellerGroup, unavailable map[uuid.UUID]bool, loaded cartContext, address *usersdirectory.ShippingAddress) types.CartView {
	view := types.CartView{Items: []types.CartItemView{}, Groups: []types.CartSellerGroupView{}, UnavailableItems: []types.UnavailableCartItemView{}, UnavailableItemCount: unavailableCartItemCount(unavailable)}
	if len(groups) == 0 {
		view.UnavailableItems = unavailableCartItems(unavailable, nil)
		return view
	}
	currency := groups[0].Currency
	view.Currency = string(currency)
	zero := money.Money{Currency: currency}
	view.ItemsTotal, view.ShopDiscount, view.StoreCredit, view.Shipping, view.Total, view.GrandTotal = zero, zero, zero, zero, zero, zero
	if address != nil {
		identifier := address.Id.String()
		view.AddressId = &identifier
		revisionGroups := make([]shippingQuoteRevisionGroup, 0, len(groups))
		for _, group := range groups {
			profile := loaded.profiles[group.StoreId]
			_, result := QuoteForGroup(group, profile, address)
			revisionGroups = append(revisionGroups, revisionGroupFor(group, result, profile))
		}
		revision := shippingQuoteRevisionFor(*address, revisionGroups)
		view.ShippingQuoteRevision = &revision
	}
	for _, group := range groups {
		if group.Currency != currency {
			view.MixedCurrencies = true
			continue
		}
		store := loaded.stores[group.StoreId]
		quote, _ := QuoteForGroup(group, loaded.profiles[group.StoreId], address)
		credit := RedeemableCreditMinor(loaded.credits[group.StoreId].BalanceMinor, group.SubtotalMinor)
		groupView := types.CartSellerGroupView{
			StoreId: group.StoreId.String(), StoreName: store.Name, Store: map[string]any{"id": group.StoreId.String(), "name": store.Name, "badge": store.Verified, "verified": store.Verified, "rating": store.RatingAverage, "ratingCount": store.RatingCount, "successRate": successRateOf(loaded.rates, group.StoreId)},
			Items: []types.CartItemView{}, Subtotal: money.Money{AmountMinor: group.SubtotalMinor, Currency: currency}, Discounts: zero, Fees: zero, Taxes: zero,
			StoreCredit: money.Money{AmountMinor: credit, Currency: currency}, Shipping: quote,
		}
		allAvailable := true
		for _, line := range group.Lines {
			item := cartItemView(line, unavailable)
			if remaining, known := loaded.available[line.Product.VariantId]; known {
				item.Product.Stock = remaining
			}
			allAvailable = allAvailable && item.Available
			groupView.Items = append(groupView.Items, item)
			view.Items = append(view.Items, item)
		}
		shipping := int64(0)
		if quote.Fee != nil {
			shipping = quote.Fee.AmountMinor
		}
		groupView.Total = money.Money{AmountMinor: group.SubtotalMinor - credit + shipping, Currency: currency}
		if quote.Status == "calculated" && allAvailable && len(unavailable) == 0 {
			view.PayableGroupCount++
			view.ItemsTotal.AmountMinor += group.SubtotalMinor
			view.Shipping.AmountMinor += shipping
			view.StoreCredit.AmountMinor += credit
		}
		if address == nil {
			// Without a destination, the cart summary describes the whole basket.
			// With a destination, ItemsTotal is the subtotal that can actually be
			// checked out; non-deliverable or unavailable seller groups stay out.
			view.ItemsTotal.AmountMinor += group.SubtotalMinor
		}
		view.Groups = append(view.Groups, groupView)
	}
	visibleItems := make(map[string]struct{}, len(view.Items))
	for _, item := range view.Items {
		visibleItems[item.Id] = struct{}{}
	}
	view.UnavailableItems = unavailableCartItems(unavailable, visibleItems)
	view.Total.AmountMinor = view.ItemsTotal.AmountMinor - view.StoreCredit.AmountMinor + view.Shipping.AmountMinor
	view.GrandTotal = view.Total
	return view
}

func unavailableCartItemCount(unavailable map[uuid.UUID]bool) int {
	count := 0
	for _, isUnavailable := range unavailable {
		if isUnavailable {
			count++
		}
	}
	return count
}

func unavailableCartItems(unavailable map[uuid.UUID]bool, visible map[string]struct{}) []types.UnavailableCartItemView {
	ids := make([]uuid.UUID, 0, len(unavailable))
	for id, isUnavailable := range unavailable {
		if !isUnavailable {
			continue
		}
		if _, found := visible[id.String()]; found {
			continue
		}
		ids = append(ids, id)
	}
	sort.Slice(ids, func(left, right int) bool { return ids[left].String() < ids[right].String() })
	result := make([]types.UnavailableCartItemView, 0, len(ids))
	for _, id := range ids {
		result = append(result, types.UnavailableCartItemView{Id: id.String()})
	}
	return result
}
