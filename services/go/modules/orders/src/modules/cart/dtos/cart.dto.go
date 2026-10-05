package dtos

type AddCartItemRequest struct {
	ProductId   string           `json:"productId"`
	VariantId   *string          `json:"variantId"`
	Size        *string          `json:"size"`
	Color       *string          `json:"color"`
	Quantity    int              `json:"quantity"`
	Attribution *SaleAttribution `json:"attribution"`
}

type SaleAttribution struct {
	Source string `json:"source"`
	Id     string `json:"id"`
}

type ChangeQuantityRequest struct {
	Quantity int `json:"quantity"`
}

type ShippingQuoteRequest struct {
	AddressId string `json:"addressId"`
}
