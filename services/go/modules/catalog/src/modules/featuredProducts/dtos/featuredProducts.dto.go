package dtos

import "zudomart/platform/money"

type FeaturedProductInput struct {
	ProductId string `json:"productId"`
	Placement string `json:"placement"`
}

type ReplaceFeaturedProductsRequest struct {
	Items []FeaturedProductInput `json:"items"`
}

type FeaturedProductView struct {
	ProductId     string      `json:"productId"`
	ProductName   string      `json:"productName"`
	ImageUrl      *string     `json:"imageUrl"`
	Price         money.Money `json:"price"`
	Placement     string      `json:"placement"`
	Position      int         `json:"position"`
	FeaturedSince string      `json:"featuredSince"`
	Views         int         `json:"views"`
	Clicks        int         `json:"clicks"`
}
