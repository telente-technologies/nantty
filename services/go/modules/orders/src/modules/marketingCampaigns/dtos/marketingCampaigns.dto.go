package dtos

import (
	"time"

	"nantty/platform/money"
)

type FlashSaleItemInput struct {
	ProductId      string `json:"productId"`
	SalePriceMinor int64  `json:"salePriceMinor"`
	StockCap       *int   `json:"stockCap"`
}

type FlashSaleRequest struct {
	Name     *string              `json:"name"`
	StartsAt *time.Time           `json:"startsAt"`
	EndsAt   *time.Time           `json:"endsAt"`
	Items    []FlashSaleItemInput `json:"items"`
	Action   *string              `json:"action"`
}

type FlashSaleItemView struct {
	ProductId     string      `json:"productId"`
	ProductName   string      `json:"productName"`
	ImageUrl      *string     `json:"imageUrl"`
	OriginalPrice money.Money `json:"originalPrice"`
	SalePrice     money.Money `json:"salePrice"`
	StockCap      *int        `json:"stockCap"`
	SoldCount     int         `json:"soldCount"`
}

type FlashSaleView struct {
	Id        string              `json:"id"`
	Name      string              `json:"name"`
	Items     []FlashSaleItemView `json:"items"`
	StartsAt  time.Time           `json:"startsAt"`
	EndsAt    time.Time           `json:"endsAt"`
	Status    string              `json:"status"`
	Reach     int                 `json:"reach"`
	Revenue   money.Money         `json:"revenue"`
	CreatedAt time.Time           `json:"createdAt"`
}

type BundleItemInput struct {
	ProductId string `json:"productId"`
	Quantity  int    `json:"quantity"`
}

type ProductBundleRequest struct {
	Name             string            `json:"name"`
	Description      string            `json:"description"`
	BundlePriceMinor int64             `json:"bundlePriceMinor"`
	Status           string            `json:"status"`
	Items            []BundleItemInput `json:"items"`
}

type BundleItemView struct {
	ProductId   string      `json:"productId"`
	ProductName string      `json:"productName"`
	ImageUrl    *string     `json:"imageUrl"`
	Quantity    int         `json:"quantity"`
	UnitPrice   money.Money `json:"unitPrice"`
}

type ProductBundleView struct {
	Id           string           `json:"id"`
	Name         string           `json:"name"`
	Description  string           `json:"description"`
	Items        []BundleItemView `json:"items"`
	BundlePrice  money.Money      `json:"bundlePrice"`
	RegularPrice money.Money      `json:"regularPrice"`
	Status       string           `json:"status"`
	SoldCount    int              `json:"soldCount"`
	Revenue      money.Money      `json:"revenue"`
	CreatedAt    time.Time        `json:"createdAt"`
}
