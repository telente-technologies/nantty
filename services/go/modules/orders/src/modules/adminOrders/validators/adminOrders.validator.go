package validators

import (
	"net/http"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/modules/adminOrders/dtos"
	"zudomart/modules/orders/src/utils"
)

var currencyPattern = regexp.MustCompile(`^[A-Z]{3}$`)

var adminOrderStatuses = append([]string{enums.StatusPending}, enums.SellerStatuses...)

var refundSources = []string{"manual", "seller", "return", "cancellation", "dispute", "system"}
var refundStatuses = []string{"processing", "completed", "failed"}

func ValidateOrderFilters(request *http.Request) error {
	var collected utils.Issues
	values := request.URL.Query()
	if status := values.Get("status"); status != "" && !slices.Contains(adminOrderStatuses, status) {
		collected.Add("status", "must be one of "+strings.Join(adminOrderStatuses, ", "))
	}
	if currency := values.Get("currency"); currency != "" && !currencyPattern.MatchString(currency) {
		collected.Add("currency", "must be a 3-letter currency code")
	}
	if utf8.RuneCountInString(values.Get("search")) > 80 {
		collected.Add("search", "must be at most 80 characters")
	}
	return collected.AsError()
}

func ValidateRefundFilters(request *http.Request) error {
	var collected utils.Issues
	values := request.URL.Query()
	if source := values.Get("source"); source != "" && !slices.Contains(refundSources, source) {
		collected.Add("source", "must be one of "+strings.Join(refundSources, ", "))
	}
	if status := values.Get("status"); status != "" && !slices.Contains(refundStatuses, status) {
		collected.Add("status", "must be one of "+strings.Join(refundStatuses, ", "))
	}
	if utf8.RuneCountInString(values.Get("search")) > 80 {
		collected.Add("search", "must be at most 80 characters")
	}
	return collected.AsError()
}

func ValidateIssueRefund(body dtos.IssueRefundRequest) error {
	var collected utils.Issues
	utils.ParseIdentifier("orderId", body.OrderId, &collected)
	if body.Amount.AmountMinor <= 0 {
		collected.Add("amount.amountMinor", "must be above zero")
	}
	collected.CheckLength("reason", strings.TrimSpace(body.Reason), 5, 1000)
	return collected.AsError()
}
