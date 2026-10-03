package dtos

type ReorderLevelUpdateRequest struct {
	VariantId       string `json:"variantId"`
	ReorderPoint    int    `json:"reorderPoint"`
	ReorderQuantity int    `json:"reorderQuantity"`
}

type ReorderLevelUpdateResponse struct {
	VariantId       string `json:"variantId"`
	ReorderPoint    int    `json:"reorderPoint"`
	ReorderQuantity int    `json:"reorderQuantity"`
}
