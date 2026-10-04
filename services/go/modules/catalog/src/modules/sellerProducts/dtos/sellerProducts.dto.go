package dtos

import "time"

type OptionRequest struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
}

type OpeningStockRequest struct {
	LocationId string `json:"locationId"`
	Quantity   int    `json:"quantity"`
}

type RegionalPriceRequest struct {
	Currency            string `json:"currency"`
	PriceMinor          int64  `json:"priceMinor"`
	CompareAtPriceMinor *int64 `json:"compareAtPriceMinor"`
}

type VariantRequest struct {
	Id                  *string                `json:"id"`
	OptionValues        map[string]string      `json:"optionValues"`
	Sku                 string                 `json:"sku"`
	Barcode             *string                `json:"barcode"`
	PriceMinor          int64                  `json:"priceMinor"`
	CompareAtPriceMinor *int64                 `json:"compareAtPriceMinor"`
	CostPriceMinor      *int64                 `json:"costPriceMinor"`
	RegionalPrices      []RegionalPriceRequest `json:"regionalPrices"`
	LowStockThreshold   int                    `json:"lowStockThreshold"`
	ReorderPoint        *int                   `json:"reorderPoint"`
	ReorderQuantity     *int                   `json:"reorderQuantity"`
	OpeningStock        []OpeningStockRequest  `json:"openingStock"`
}

type AttributeRequest struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type VideoRequest struct {
	Url   string `json:"url"`
	Title string `json:"title"`
}

type BrandRequest struct {
	BrandId      string `json:"brandId"`
	Relationship string `json:"relationship"`
}

type ProductUpsertRequest struct {
	Name            string              `json:"name"`
	Description     string              `json:"description"`
	CategoryId      *string             `json:"categoryId"`
	Status          string              `json:"status"`
	Taxable         bool                `json:"taxable"`
	TrackInventory  bool                `json:"trackInventory"`
	PublishedOnline bool                `json:"publishedOnline"`
	Tags            []string            `json:"tags"`
	Options         []OptionRequest     `json:"options"`
	ImageMediaIds   []string            `json:"imageMediaIds"`
	Variants        []VariantRequest    `json:"variants"`
	Brand           *BrandRequest       `json:"brand"`
	Visibility      *string             `json:"visibility"`
	PublishAt       *time.Time          `json:"publishAt"`
	Attributes      *[]AttributeRequest `json:"attributes"`
	Videos          *[]VideoRequest     `json:"videos"`
	SupplierId      *string             `json:"supplierId"`
}

type BulkActionRequest struct {
	Action                  string   `json:"action"`
	ProductIds              []string `json:"productIds"`
	CategoryId              *string  `json:"categoryId"`
	Visibility              *string  `json:"visibility"`
	PricePercentBasisPoints *int     `json:"pricePercentBasisPoints"`
}

type BarcodeRequest struct {
	Count int `json:"count"`
}

type BulkActionResult struct {
	UpdatedProductIds []string `json:"updatedProductIds"`
}
