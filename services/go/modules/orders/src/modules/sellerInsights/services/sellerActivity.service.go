package services

import (
	"sort"
	"strconv"
	"time"

	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/modules/sellerInsights/dtos"
	"zudomart/platform/commerceports"
)

type timedActivity struct {
	at    time.Time
	entry dtos.ActivityEntry
}

func optional(text string) *string {
	if text == "" {
		return nil
	}
	return &text
}

func (orders StoreOrders) Activity(returns []*ent.ReturnRequest, audit []commerceports.StoreAuditEntryView, limit int) []dtos.ActivityEntry {
	collected := []timedActivity{}
	add := func(at time.Time, id, kind, summary, actor, href string) {
		if at.IsZero() || at.After(orders.Now) {
			return
		}
		collected = append(collected, timedActivity{at: at, entry: dtos.ActivityEntry{Id: id, Kind: kind, Summary: summary, ActorName: optional(actor), Href: optional(href), CreatedAt: at.UTC().Format(time.RFC3339)}})
	}
	for _, group := range orders.Groups {
		href := "/orders/" + group.ID.String()
		add(group.CreatedAt, "placed-"+group.ID.String(), "order_placed", "New order "+group.Reference+" from "+group.BuyerName, group.BuyerName, href)
		if group.ShippedAt != nil {
			add(*group.ShippedAt, "shipped-"+group.ID.String(), "order_shipped", "Order "+group.Reference+" was shipped", "", href)
		}
		if group.DeliveredAt != nil {
			add(*group.DeliveredAt, "delivered-"+group.ID.String(), "order_delivered", "Order "+group.Reference+" was delivered", "", href)
		}
		if group.Status == enums.StatusDisputed {
			add(group.UpdatedAt, "disputed-"+group.ID.String(), "dispute_opened", "The buyer opened a dispute on "+group.Reference, group.BuyerName, "/orders/disputes")
		}
	}
	for _, request := range returns {
		add(request.CreatedAt, "return-"+request.ID.String(), "return_requested", "A buyer asked to return an order", "", "/orders/returns")
	}
	for _, entry := range audit {
		add(entry.CreatedAt, "audit-"+entry.Id, "team_action", entry.Summary, entry.ActorName, "/staff/activity")
	}
	sort.SliceStable(collected, func(left, right int) bool { return collected[left].at.After(collected[right].at) })
	activity := make([]dtos.ActivityEntry, 0, limit)
	for index := 0; index < len(collected) && index < limit; index++ {
		activity = append(activity, collected[index].entry)
	}
	return activity
}

func (orders StoreOrders) Alerts(requestedReturns, disputesAwaiting int, stock commerceports.StockAlertSummary) []dtos.Alert {
	toAccept := 0
	for _, group := range orders.Groups {
		if group.Status == enums.StatusNew {
			toAccept++
		}
	}
	candidates := []dtos.Alert{
		{Kind: "orders_to_accept", Severity: "caution", Count: toAccept, Title: plural(toAccept, "order", "orders") + " to accept", Description: "Accept or reject new orders so buyers know you are on it.", Href: "/orders?status=new"},
		{Kind: "disputes_awaiting_response", Severity: "error", Count: disputesAwaiting, Title: plural(disputesAwaiting, "dispute", "disputes") + " need your reply", Description: "Reply before the deadline or Zudomart decides without you.", Href: "/orders/disputes"},
		{Kind: "returns_requested", Severity: "caution", Count: requestedReturns, Title: plural(requestedReturns, "return request", "return requests"), Description: "Approve or decline return requests.", Href: "/orders/returns"},
		{Kind: "out_of_stock", Severity: "error", Count: stock.OutOfStockCount, Title: plural(stock.OutOfStockCount, "item", "items") + " out of stock", Description: "Buyers cannot order these until you restock.", Href: "/inventory?status=out_of_stock"},
		{Kind: "low_stock", Severity: "info", Count: stock.LowStockCount, Title: plural(stock.LowStockCount, "item", "items") + " running low", Description: "Restock before they sell out.", Href: "/inventory?status=low_stock"},
	}
	alerts := []dtos.Alert{}
	for _, alert := range candidates {
		if alert.Count > 0 {
			alerts = append(alerts, alert)
		}
	}
	return alerts
}

func plural(count int, singular, many string) string {
	if count == 1 {
		return "1 " + singular
	}
	return strconv.Itoa(count) + " " + many
}
