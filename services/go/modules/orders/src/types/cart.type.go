package types

import "nantty/platform/money"

type ProductSummaryView struct {
	Id       string      `json:"id"`
	Name     string      `json:"name"`
	Price    money.Money `json:"price"`
	ImageUrl *string     `json:"imageUrl"`
	Stock    int         `json:"stock"`
}

type CartVariantView struct {
	Id    string `json:"id"`
	Size  string `json:"size"`
	Color string `json:"color"`
	Sku   string `json:"sku"`
	Title string `json:"title"`
}

type CartItemView struct {
	Id            string               `json:"id"`
	Product       ProductSummaryView   `json:"product"`
	Quantity      int                  `json:"quantity"`
	Variant       *string              `json:"variant"`
	VariantDetail *CartVariantView     `json:"variantDetail"`
	StoreId       string               `json:"storeId"`
	Available     bool                 `json:"available"`
	Attribution   *SaleAttributionView `json:"attribution"`
}

var SaleAttributionSources = []string{"post", "clip", "live", "link"}

type SaleAttributionView struct {
	Source string `json:"source"`
	Id     string `json:"id"`
}

type ShippingQuoteView struct {
	Status               string       `json:"status"`
	Fee                  *money.Money `json:"fee"`
	Message              *string      `json:"message"`
	IsFree               bool         `json:"isFree"`
	FreeThreshold        *money.Money `json:"freeThreshold"`
	AmountToFreeShipping *money.Money `json:"amountToFreeShipping"`
}

type CartSellerGroupView struct {
	StoreId     string            `json:"storeId"`
	StoreName   string            `json:"storeName"`
	Store       map[string]any    `json:"store"`
	Items       []CartItemView    `json:"items"`
	Subtotal    money.Money       `json:"subtotal"`
	Discounts   money.Money       `json:"discounts"`
	Fees        money.Money       `json:"fees"`
	Taxes       money.Money       `json:"taxes"`
	StoreCredit money.Money       `json:"storeCredit"`
	Shipping    ShippingQuoteView `json:"shipping"`
	Total       money.Money       `json:"total"`
}

type CartView struct {
	Items             []CartItemView        `json:"items"`
	ItemsTotal        money.Money           `json:"itemsTotal"`
	ShopDiscount      money.Money           `json:"shopDiscount"`
	StoreCredit       money.Money           `json:"storeCredit"`
	Shipping          money.Money           `json:"shipping"`
	Total             money.Money           `json:"total"`
	GrandTotal        money.Money           `json:"grandTotal"`
	Currency          string                `json:"currency"`
	Groups            []CartSellerGroupView `json:"groups"`
	AddressId         *string               `json:"addressId"`
	PayableGroupCount int                   `json:"payableGroupCount"`
	MixedCurrencies   bool                  `json:"mixedCurrencies"`
}
