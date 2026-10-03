package dtos

type TransferLineRequest struct {
	VariantId string `json:"variantId"`
	Quantity  int    `json:"quantity"`
}

type TransferRequest struct {
	FromLocationId string                `json:"fromLocationId"`
	ToLocationId   string                `json:"toLocationId"`
	Lines          []TransferLineRequest `json:"lines"`
	Note           *string               `json:"note"`
}
