package dtos

import (
	"time"

	"zudomart/platform/money"
)

type ReturnLineRequest struct {
	OrderItemId string `json:"orderItemId"`
	Quantity    int    `json:"quantity"`
}

type RequestReturnRequest struct {
	Lines  []ReturnLineRequest `json:"lines"`
	Reason string              `json:"reason"`
}

type DeclineRequest struct {
	Note string `json:"note"`
}

type ReceiveRequest struct {
	Restock    bool    `json:"restock"`
	LocationId *string `json:"locationId"`
}

type ReturnLineView struct {
	OrderLineId string `json:"orderLineId"`
	Name        string `json:"name"`
	Quantity    int    `json:"quantity"`
}

type ReturnView struct {
	Id           string           `json:"id"`
	OrderId      string           `json:"orderId"`
	OrderNumber  string           `json:"orderNumber"`
	BuyerName    string           `json:"buyerName"`
	Lines        []ReturnLineView `json:"lines"`
	Reason       string           `json:"reason"`
	Status       string           `json:"status"`
	DeclineNote  *string          `json:"declineNote"`
	RefundAmount money.Money      `json:"refundAmount"`
	CreatedAt    time.Time        `json:"createdAt"`
}
