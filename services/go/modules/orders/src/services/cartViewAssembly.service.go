package services

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/types"
	"zudomart/platform/money"
	"zudomart/platform/usersdirectory"
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
	if product.VariantTitle != "" && product.VariantTitle != "Default" {
		title := product.VariantTitle
		view.Variant = &title
	}
	return view
}

func assembleCartView(groups []SellerGroup, unavailable map[uuid.UUID]bool, loaded cartContext, address *usersdirectory.ShippingAddress) types.CartView {
	view := types.CartView{Items: []types.CartItemView{}, Groups: []types.CartSellerGroupView{}}
	if len(groups) == 0 {
		return view
	}
	currency := groups[0].Currency
	view.Currency = string(currency)
	zero := money.Money{Currency: currency}
	view.ItemsTotal, view.ShopDiscount, view.StoreCredit, view.Shipping, view.Total, view.GrandTotal = zero, zero, zero, zero, zero, zero
	if address != nil {
		identifier := address.Id.String()
		view.AddressId = &identifier
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
			allAvailable = allAvailable && item.Available
			groupView.Items = append(groupView.Items, item)
			view.Items = append(view.Items, item)
		}
		shipping := int64(0)
		if quote.Fee != nil {
			shipping = quote.Fee.AmountMinor
		}
		groupView.Total = money.Money{AmountMinor: group.SubtotalMinor - credit + shipping, Currency: currency}
		if quote.Status == "calculated" && allAvailable {
			view.PayableGroupCount++
			view.Shipping.AmountMinor += shipping
			view.StoreCredit.AmountMinor += credit
		}
		view.ItemsTotal.AmountMinor += group.SubtotalMinor
		view.Groups = append(view.Groups, groupView)
	}
	view.Total.AmountMinor = view.ItemsTotal.AmountMinor - view.StoreCredit.AmountMinor + view.Shipping.AmountMinor
	view.GrandTotal = view.Total
	return view
}
