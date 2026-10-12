package services

import (
	"strconv"
	"strings"
	"time"
)

type AttributedItem struct {
	OrderItemId       string     `json:"orderItemId"`
	ProductId         string     `json:"productId"`
	VariantId         string     `json:"variantId"`
	Quantity          int64      `json:"quantity"`
	LineTotalMinor    int64      `json:"lineTotalMinor"`
	Currency          string     `json:"currency"`
	AttributionSource string     `json:"attributionSource"`
	AttributionId     string     `json:"attributionId"`
	AttributedAt      *time.Time `json:"attributedAt"`
	CommissionBps     *int64     `json:"commissionBasisPoints"`
}

type OrderGroupCompleted struct {
	OrderGroupId    string           `json:"orderGroupId"`
	OrderNumber     string           `json:"orderNumber"`
	StoreId         string           `json:"storeId"`
	SellerAccountId string           `json:"sellerAccountId"`
	BuyerAccountId  string           `json:"buyerAccountId"`
	SubtotalMinor   int64            `json:"subtotalMinor"`
	TotalMinor      int64            `json:"totalMinor"`
	RefundedMinor   int64            `json:"refundedMinor"`
	Currency        string           `json:"currency"`
	OrderedAt       *time.Time       `json:"orderedAt"`
	CompletedAt     *time.Time       `json:"completedAt"`
	AttributedItems []AttributedItem `json:"attributedItems"`
}

type OrderGroupPaid struct {
	OrderGroupId    string           `json:"orderGroupId"`
	OrderNumber     string           `json:"orderNumber"`
	StoreId         string           `json:"storeId"`
	SellerAccountId string           `json:"sellerAccountId"`
	BuyerAccountId  string           `json:"buyerAccountId"`
	Currency        string           `json:"currency"`
	OrderedAt       *time.Time       `json:"orderedAt"`
	AttributedItems []AttributedItem `json:"attributedItems"`
}

type OrderGroupStatusChanged struct {
	OrderGroupId string `json:"orderGroupId"`
	From         string `json:"from"`
	To           string `json:"to"`
}

type AffiliateSaleReleased struct {
	OrderId      string
	OrderNumber  string
	StoreId      string
	SellerUserId string
	BuyerUserId  string
	Currency     string
	OrderedAt    *time.Time
	Items        []AttributedItem
}

func (completed OrderGroupCompleted) Sale() AffiliateSaleReleased {
	items := make([]AttributedItem, 0, len(completed.AttributedItems))
	for _, item := range completed.AttributedItems {
		if completed.RefundedMinor > 0 && completed.SubtotalMinor > 0 {
			kept := max(completed.SubtotalMinor-completed.RefundedMinor, 0)
			item.LineTotalMinor = item.LineTotalMinor/completed.SubtotalMinor*kept + item.LineTotalMinor%completed.SubtotalMinor*kept/completed.SubtotalMinor
		}
		items = append(items, item)
	}
	return AffiliateSaleReleased{
		OrderId: completed.OrderGroupId, OrderNumber: completed.OrderNumber, StoreId: completed.StoreId, SellerUserId: completed.SellerAccountId,
		BuyerUserId: completed.BuyerAccountId, Currency: completed.Currency, OrderedAt: completed.OrderedAt, Items: items,
	}
}

func (paid OrderGroupPaid) Sale() AffiliateSaleReleased {
	return AffiliateSaleReleased{
		OrderId: paid.OrderGroupId, OrderNumber: paid.OrderNumber, StoreId: paid.StoreId, SellerUserId: paid.SellerAccountId,
		BuyerUserId: paid.BuyerAccountId, Currency: paid.Currency, OrderedAt: paid.OrderedAt, Items: paid.AttributedItems,
	}
}

var voidingOrderStatuses = map[string]string{"cancelled": "cancelled", "refunded": "refunded", "returned": "returned"}

func (changed OrderGroupStatusChanged) VoidReason() (string, bool) {
	reason, voids := voidingOrderStatuses[changed.To]
	return reason, voids && changed.From != "completed"
}

var attributionSources = map[string]bool{"post": true, "clip": true, "live": true, "link": true}

type attributedSale struct {
	itemKey, productId, source, sourceId string
	amountMinor                          int64
	lockedBps                            *int64
	attributedAt                         *time.Time
}

func attributedSales(orderId, currency string, items []AttributedItem) []attributedSale {
	sales := []attributedSale{}
	for index, item := range items {
		sameCurrency := item.Currency == "" || strings.EqualFold(item.Currency, currency)
		if item.ProductId == "" || item.LineTotalMinor <= 0 || item.AttributionId == "" || !attributionSources[item.AttributionSource] || !sameCurrency {
			continue
		}
		key := item.OrderItemId
		if key == "" {
			key = orderId + ":" + item.ProductId + ":" + strconv.Itoa(index)
		}
		sales = append(sales, attributedSale{itemKey: key, productId: item.ProductId, source: item.AttributionSource, sourceId: item.AttributionId, amountMinor: item.LineTotalMinor,
			lockedBps: item.CommissionBps, attributedAt: item.AttributedAt})
	}
	return sales
}

func withinAttributionWindow(attributedAt, orderedAt *time.Time, windowDays int, now time.Time) bool {
	if attributedAt == nil {
		return true
	}
	if windowDays <= 0 {
		windowDays = 30
	}
	purchasedAt := now
	if orderedAt != nil {
		purchasedAt = *orderedAt
	}
	return !purchasedAt.After(attributedAt.Add(time.Duration(windowDays) * 24 * time.Hour))
}
