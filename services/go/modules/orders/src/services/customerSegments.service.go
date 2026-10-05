package services

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"zudomart/modules/orders/src/databases/schema"
	"zudomart/platform/money"
)

type SegmentDefinition struct {
	Id          string
	Name        string
	Description string
	Kind        string
	Rules       []schema.CustomerSegmentRule
	CreatedAt   time.Time
	matches     func(CustomerView) bool
}

type SegmentView struct {
	Id                string                       `json:"id"`
	Name              string                       `json:"name"`
	Description       string                       `json:"description"`
	Kind              string                       `json:"kind"`
	Rules             []schema.CustomerSegmentRule `json:"rules"`
	CustomerCount     int                          `json:"customerCount"`
	TotalSpent        money.Money                  `json:"totalSpent"`
	AverageOrderValue *money.Money                 `json:"averageOrderValue"`
	CreatedAt         string                       `json:"createdAt"`
}

func daysSince(moment *time.Time, now time.Time) int {
	if moment == nil {
		return math.MaxInt32
	}
	return int(now.Sub(*moment).Hours() / 24)
}

func vipSpendThreshold(customers []CustomerView) int64 {
	spends := []int64{}
	for _, customer := range customers {
		if customer.PurchasesCount > 0 {
			spends = append(spends, customer.TotalSpent.AmountMinor)
		}
	}
	if len(spends) == 0 {
		return math.MaxInt64
	}
	sort.Slice(spends, func(left, right int) bool { return spends[left] > spends[right] })
	cut := max(int(math.Ceil(float64(len(spends))*0.15)), 1)
	return spends[cut-1]
}

func BuiltInSegments(customers []CustomerView, now time.Time) []SegmentDefinition {
	threshold := vipSpendThreshold(customers)
	return []SegmentDefinition{
		{Id: "seg_new", Name: "New customers", Description: "One order, placed in the last 30 days.", Kind: "built_in",
			matches: func(customer CustomerView) bool {
				return customer.PurchasesCount == 1 && daysSince(customer.FirstPurchaseAt, now) <= 30
			}},
		{Id: "seg_returning", Name: "Returning customers", Description: "Two or more orders.", Kind: "built_in",
			matches: func(customer CustomerView) bool { return customer.PurchasesCount >= 2 }},
		{Id: "seg_vip", Name: "VIP", Description: "Your top 15% of customers by spend.", Kind: "built_in",
			matches: func(customer CustomerView) bool {
				return customer.PurchasesCount > 0 && customer.TotalSpent.AmountMinor >= threshold
			}},
		{Id: "seg_at_risk", Name: "At risk", Description: "Two or more orders, but none for 60 days.", Kind: "built_in",
			matches: func(customer CustomerView) bool {
				return customer.PurchasesCount >= 2 && daysSince(customer.LastPurchaseAt, now) >= 60
			}},
	}
}

func CustomSegment(id, name, description string, rules []schema.CustomerSegmentRule, createdAt time.Time, now time.Time) SegmentDefinition {
	return SegmentDefinition{Id: id, Name: name, Description: description, Kind: "custom", Rules: rules, CreatedAt: createdAt, matches: func(customer CustomerView) bool {
		for _, rule := range rules {
			if !ruleMatches(rule, customer, now) {
				return false
			}
		}
		return true
	}}
}

func numericValue(value any) (float64, bool) {
	number, ok := value.(float64)
	return number, ok
}

func compareNumber(actual float64, operator string, expected float64) bool {
	switch operator {
	case "at_least":
		return actual >= expected
	case "at_most":
		return actual <= expected
	}
	return actual == expected
}

func ruleMatches(rule schema.CustomerSegmentRule, customer CustomerView, now time.Time) bool {
	switch rule.Field {
	case "tag":
		return CustomerHasTag(customer, fmt.Sprint(rule.Value))
	case "city":
		return strings.EqualFold(derefText(customer.City), fmt.Sprint(rule.Value))
	case "marketing_opt_in":
		expected, _ := rule.Value.(bool)
		return customer.MarketingOptIn == expected
	}
	expected, ok := numericValue(rule.Value)
	if !ok {
		return false
	}
	actual := 0.0
	switch rule.Field {
	case "total_spent":
		actual = float64(customer.TotalSpent.AmountMinor)
	case "average_order_value":
		if customer.AverageOrderValue != nil {
			actual = float64(customer.AverageOrderValue.AmountMinor)
		}
	case "purchases_count":
		actual = float64(customer.PurchasesCount)
	case "days_since_last_purchase":
		actual = float64(daysSince(customer.LastPurchaseAt, now))
	case "days_since_first_purchase":
		actual = float64(daysSince(customer.FirstPurchaseAt, now))
	default:
		return false
	}
	return compareNumber(actual, rule.Operator, expected)
}

func (definition SegmentDefinition) Members(customers []CustomerView) []CustomerView {
	members := []CustomerView{}
	for _, customer := range customers {
		if definition.matches(customer) {
			members = append(members, customer)
		}
	}
	return members
}

func (definition SegmentDefinition) Present(customers []CustomerView, currency money.CurrencyCode) SegmentView {
	members := definition.Members(customers)
	total, orders := int64(0), 0
	for _, member := range members {
		total += member.TotalSpent.AmountMinor
		orders += member.PurchasesCount
	}
	var average *money.Money
	if orders > 0 {
		average = &money.Money{AmountMinor: total / int64(orders), Currency: currency}
	}
	rules := definition.Rules
	if rules == nil {
		rules = []schema.CustomerSegmentRule{}
	}
	created := ""
	if !definition.CreatedAt.IsZero() {
		created = definition.CreatedAt.UTC().Format(time.RFC3339)
	}
	return SegmentView{Id: definition.Id, Name: definition.Name, Description: definition.Description, Kind: definition.Kind, Rules: rules,
		CustomerCount: len(members), TotalSpent: money.Money{AmountMinor: total, Currency: currency}, AverageOrderValue: average, CreatedAt: created}
}
