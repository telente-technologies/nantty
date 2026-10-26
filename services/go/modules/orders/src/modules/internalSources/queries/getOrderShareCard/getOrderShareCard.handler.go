package getordersharecard

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/generated/ent/orderitem"
)

type Query struct {
	OrderId  uuid.UUID
	ViewerId uuid.UUID
}

type Money struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type ShareCard struct {
	OrderId     string  `json:"orderId"`
	StoreId     string  `json:"storeId"`
	OrderNumber string  `json:"orderNumber"`
	Status      string  `json:"status"`
	ItemCount   int     `json:"itemCount"`
	Total       Money   `json:"total"`
	ImageUrl    *string `json:"imageUrl"`
}

type TeamLookup func(ctx context.Context, storeId uuid.UUID) ([]uuid.UUID, error)

type Handler struct {
	Container *container.Container
	Team      TeamLookup
}

func (handler Handler) Execute(ctx context.Context, query Query) (ShareCard, error) {
	group, err := handler.Container.Client.OrderGroup.Query().Where(ordergroup.ID(query.OrderId)).Only(ctx)
	if ent.IsNotFound(err) {
		return ShareCard{}, ordererrors.OrderNotFound
	}
	if err != nil {
		return ShareCard{}, err
	}
	if group.BuyerAccountID != query.ViewerId {
		team, err := handler.Team(ctx, group.StoreID)
		if err != nil {
			return ShareCard{}, err
		}
		if !slices.Contains(team, query.ViewerId) {
			return ShareCard{}, ordererrors.OrderNotFound
		}
	}
	items, err := handler.Container.Client.OrderItem.Query().Where(orderitem.OrderGroupID(group.ID)).All(ctx)
	if err != nil {
		return ShareCard{}, err
	}
	card := ShareCard{OrderId: group.ID.String(), StoreId: group.StoreID.String(), OrderNumber: group.Reference, Status: group.Status, Total: Money{AmountMinor: group.TotalMinor, Currency: group.Currency}}
	for _, item := range items {
		card.ItemCount += item.Quantity
		if card.ImageUrl == nil && item.ImageURL != nil {
			card.ImageUrl = item.ImageURL
		}
	}
	return card, nil
}

type ExternalShareCard struct {
	Availability string  `json:"availability"`
	Title        string  `json:"title"`
	Subtitle     string  `json:"subtitle"`
	ImageUrl     *string `json:"imageUrl"`
	PriceLabel   string  `json:"priceLabel"`
	OrderStatus  string  `json:"orderStatus"`
	ItemCount    int     `json:"itemCount"`
	Total        Money   `json:"total"`
}

func Present(card ShareCard) ExternalShareCard {
	items := fmt.Sprintf("%d item", card.ItemCount)
	if card.ItemCount != 1 {
		items += "s"
	}
	status := strings.ReplaceAll(card.Status, "_", " ")
	return ExternalShareCard{
		Availability: "available", Title: "Order " + card.OrderNumber, Subtitle: items + " · " + status, ImageUrl: card.ImageUrl,
		PriceLabel: FormatMinor(card.Total), OrderStatus: card.Status, ItemCount: card.ItemCount, Total: card.Total,
	}
}

func FormatMinor(money Money) string {
	whole := money.AmountMinor / 100
	fraction := money.AmountMinor % 100
	if fraction < 0 {
		fraction = -fraction
	}
	digits := fmt.Sprintf("%d", whole)
	var grouped strings.Builder
	for index, digit := range digits {
		if index > 0 && (len(digits)-index)%3 == 0 && digit != '-' && digits[index-1] != '-' {
			grouped.WriteByte(',')
		}
		grouped.WriteRune(digit)
	}
	return fmt.Sprintf("%s %s.%02d", money.Currency, grouped.String(), fraction)
}
