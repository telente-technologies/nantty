package dtos

type AdjustmentLineRequest struct {
	VariantId     string `json:"variantId"`
	QuantityDelta int    `json:"quantityDelta"`
}

type AdjustmentRequest struct {
	LocationId string                  `json:"locationId"`
	Reason     string                  `json:"reason"`
	Note       *string                 `json:"note"`
	Lines      []AdjustmentLineRequest `json:"lines"`
}
