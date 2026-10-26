package dtos

import "nantty/modules/catalog/src/databases/schema"

type ImportRow struct {
	RowNumber         int    `json:"rowNumber"`
	ProductName       string `json:"productName"`
	Description       string `json:"description"`
	CategoryName      string `json:"categoryName"`
	Option1Name       string `json:"option1Name"`
	Option1Value      string `json:"option1Value"`
	Option2Name       string `json:"option2Name"`
	Option2Value      string `json:"option2Value"`
	Sku               string `json:"sku"`
	Barcode           string `json:"barcode"`
	Price             string `json:"price"`
	CompareAtPrice    string `json:"compareAtPrice"`
	CostPrice         string `json:"costPrice"`
	LowStockThreshold string `json:"lowStockThreshold"`
	OpeningStock      string `json:"openingStock"`
	Taxable           string `json:"taxable"`
	PublishedOnline   string `json:"publishedOnline"`
}

type ImportRequest struct {
	LocationId string      `json:"locationId"`
	Rows       []ImportRow `json:"rows"`
}

type ImportJobView struct {
	JobId   string                        `json:"jobId"`
	Status  string                        `json:"status"`
	DryRun  bool                          `json:"dryRun"`
	Created int                           `json:"created"`
	Updated int                           `json:"updated"`
	Failed  []schema.ProductImportFailure `json:"failed"`
}
