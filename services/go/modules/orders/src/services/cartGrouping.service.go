package services

import (
	"errors"
	"time"

	"github.com/google/uuid"

	"nantty/platform/commerceports"
	"nantty/platform/money"
)

type PricedCartLine struct {
	ItemId            uuid.UUID
	Quantity          int
	Product           commerceports.ProductSnapshot
	AttributionSource *string
	AttributionId     *uuid.UUID
	AttributedAt      *time.Time
	CommissionBps     *int64
}

type SellerGroup struct {
	StoreId       uuid.UUID
	Lines         []PricedCartLine
	SubtotalMinor int64
	Currency      money.CurrencyCode
}

var ErrCartLineCurrencyMismatch = errors.New("a store's cart lines must share one currency")

func GroupCartLinesBySeller(lines []PricedCartLine) ([]SellerGroup, error) {
	groups := []SellerGroup{}
	positions := map[uuid.UUID]int{}
	for _, line := range lines {
		position, exists := positions[line.Product.StoreId]
		if !exists {
			position = len(groups)
			positions[line.Product.StoreId] = position
			groups = append(groups, SellerGroup{StoreId: line.Product.StoreId, Currency: line.Product.UnitPrice.Currency})
		}
		group := &groups[position]
		if line.Product.UnitPrice.Currency != group.Currency {
			return nil, ErrCartLineCurrencyMismatch
		}
		lineTotal, err := line.Product.UnitPrice.MultiplyByQuantity(int64(line.Quantity))
		if err != nil {
			return nil, err
		}
		subtotal, err := money.Money{AmountMinor: group.SubtotalMinor, Currency: group.Currency}.Add(lineTotal)
		if err != nil {
			return nil, err
		}
		group.SubtotalMinor = subtotal.AmountMinor
		group.Lines = append(group.Lines, line)
	}
	return groups, nil
}
