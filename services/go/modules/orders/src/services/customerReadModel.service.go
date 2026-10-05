package services

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/customernote"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/platform/money"
)

type CustomerNoteView struct {
	Id        string         `json:"id"`
	Body      string         `json:"body"`
	Author    map[string]any `json:"author"`
	CreatedAt time.Time      `json:"createdAt"`
}

type CustomerView struct {
	Id                   string             `json:"id"`
	Name                 string             `json:"name"`
	Phone                *string            `json:"phone"`
	Email                *string            `json:"email"`
	ZudomartUsername     *string            `json:"zudomartUsername"`
	City                 *string            `json:"city"`
	Tags                 []string           `json:"tags"`
	Notes                []CustomerNoteView `json:"notes"`
	StoreCreditBalance   money.Money        `json:"storeCreditBalance"`
	StoreCreditExpiresAt *time.Time         `json:"storeCreditExpiresAt"`
	TotalSpent           money.Money        `json:"totalSpent"`
	AverageOrderValue    *money.Money       `json:"averageOrderValue"`
	PurchasesCount       int                `json:"purchasesCount"`
	FirstPurchaseAt      *time.Time         `json:"firstPurchaseAt"`
	LastPurchaseAt       *time.Time         `json:"lastPurchaseAt"`
	CreatedAt            time.Time          `json:"createdAt"`
	MarketingOptIn       bool               `json:"marketingOptIn"`
}

func BuildCustomers(groups []*ent.OrderGroup, currency money.CurrencyCode) []CustomerView {
	byBuyer := map[uuid.UUID]*CustomerView{}
	order := []uuid.UUID{}
	for _, group := range groups {
		if group.PaymentStatus == enums.PaymentPending {
			continue
		}
		view := byBuyer[group.BuyerAccountID]
		if view == nil {
			view = &CustomerView{Id: group.BuyerAccountID.String(), Tags: []string{}, Notes: []CustomerNoteView{}, CreatedAt: group.CreatedAt,
				StoreCreditBalance: money.Money{Currency: currency}, TotalSpent: money.Money{Currency: currency}}
			byBuyer[group.BuyerAccountID] = view
			order = append(order, group.BuyerAccountID)
		}
		username, name, phone := group.BuyerUsername, group.BuyerName, group.Address.Phone
		view.Name, view.ZudomartUsername, view.Phone = name, &username, &phone
		if city := firstNonEmpty(group.Address.CityName, group.Address.AdminAreaName); city != "" {
			view.City = &city
		}
		if group.CreatedAt.Before(view.CreatedAt) {
			view.CreatedAt = group.CreatedAt
		}
		if group.Status == enums.StatusCancelled || group.Status == enums.StatusRefunded {
			continue
		}
		moment := group.CreatedAt
		view.PurchasesCount++
		view.TotalSpent.AmountMinor += group.SubtotalMinor
		if view.FirstPurchaseAt == nil || moment.Before(*view.FirstPurchaseAt) {
			view.FirstPurchaseAt = &moment
		}
		if view.LastPurchaseAt == nil || moment.After(*view.LastPurchaseAt) {
			view.LastPurchaseAt = &moment
		}
	}
	customers := make([]CustomerView, 0, len(order))
	for _, buyerId := range order {
		view := byBuyer[buyerId]
		if view.PurchasesCount > 0 {
			average := money.Money{AmountMinor: view.TotalSpent.AmountMinor / int64(view.PurchasesCount), Currency: currency}
			view.AverageOrderValue = &average
		}
		customers = append(customers, *view)
	}
	return customers
}

func FilterAndSortCustomers(customers []CustomerView, text, kind, sortKey string, descending bool) []CustomerView {
	kept := make([]CustomerView, 0, len(customers))
	for _, customer := range customers {
		if text != "" && !customerMatches(customer, strings.ToLower(text)) {
			continue
		}
		if (kind == "new" && customer.PurchasesCount != 1) || (kind == "returning" && customer.PurchasesCount < 2) || (kind == "no_orders" && customer.PurchasesCount != 0) {
			continue
		}
		kept = append(kept, customer)
	}
	sort.SliceStable(kept, func(left, right int) bool {
		less := customerLess(kept[left], kept[right], sortKey)
		if descending {
			return customerLess(kept[right], kept[left], sortKey)
		}
		return less
	})
	return kept
}

func customerMatches(customer CustomerView, text string) bool {
	for _, candidate := range []string{customer.Name, derefText(customer.ZudomartUsername), derefText(customer.Phone), derefText(customer.City), derefText(customer.Email)} {
		if strings.Contains(strings.ToLower(candidate), text) {
			return true
		}
	}
	return false
}

func derefText(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func timeOf(value *time.Time) time.Time {
	if value == nil {
		return time.Time{}
	}
	return *value
}

func customerLess(left, right CustomerView, key string) bool {
	switch key {
	case "spend":
		return left.TotalSpent.AmountMinor < right.TotalSpent.AmountMinor
	case "purchases":
		return left.PurchasesCount < right.PurchasesCount
	case "first":
		return timeOf(left.FirstPurchaseAt).Before(timeOf(right.FirstPurchaseAt))
	case "name":
		return strings.ToLower(left.Name) < strings.ToLower(right.Name)
	case "aov":
		leftValue, rightValue := int64(0), int64(0)
		if left.AverageOrderValue != nil {
			leftValue = left.AverageOrderValue.AmountMinor
		}
		if right.AverageOrderValue != nil {
			rightValue = right.AverageOrderValue.AmountMinor
		}
		return leftValue < rightValue
	}
	return timeOf(left.LastPurchaseAt).Before(timeOf(right.LastPurchaseAt))
}

func LoadStoreCustomers(ctx context.Context, deployed *container.Container, storeId uuid.UUID, currency money.CurrencyCode) ([]CustomerView, error) {
	groups, err := deployed.Client.OrderGroup.Query().Where(ordergroup.StoreID(storeId)).Order(ent.Asc(ordergroup.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	customers := BuildCustomers(groups, currency)
	states, err := LoadStoreCreditStates(ctx, deployed, storeId)
	if err != nil {
		return nil, err
	}
	for index := range customers {
		if state, found := states[uuid.MustParse(customers[index].Id)]; found {
			customers[index].StoreCreditBalance.AmountMinor = state.BalanceMinor
			customers[index].StoreCreditExpiresAt = state.NextExpiryAt
		}
	}
	return applyCustomerProfiles(ctx, deployed, storeId, currency, customers)
}

func LoadCustomerNotes(ctx context.Context, deployed *container.Container, storeId, buyerId uuid.UUID) ([]CustomerNoteView, error) {
	rows, err := deployed.Client.CustomerNote.Query().Where(customernote.StoreID(storeId), customernote.BuyerAccountID(buyerId)).Order(ent.Desc(customernote.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	notes := make([]CustomerNoteView, 0, len(rows))
	for _, row := range rows {
		notes = append(notes, CustomerNoteView{Id: row.ID.String(), Body: row.Body, Author: map[string]any{"id": row.AuthorAccountID.String(), "name": row.AuthorName}, CreatedAt: row.CreatedAt})
	}
	return notes, nil
}
