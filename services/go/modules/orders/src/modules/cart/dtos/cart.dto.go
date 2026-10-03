package dtos

type AddCartItemRequest struct {
	ProductId string  `json:"productId"`
	VariantId *string `json:"variantId"`
	Size      *string `json:"size"`
	Color     *string `json:"color"`
	Quantity  int     `json:"quantity"`
}

type ChangeQuantityRequest struct {
	Quantity int `json:"quantity"`
}

type ShippingQuoteRequest struct {
	AddressId string `json:"addressId"`
}
