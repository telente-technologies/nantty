package validators

import (
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/modules/wallet/src/modules/sellerMoney/services"
)

var transactionKinds = []string{"escrow_hold", "escrow_release", "payout", "refund", "fee", "affiliate_commission", "ads_charge", "subscription_charge", "adjustment"}

func ReadLimit(request *http.Request, defaultLimit int) (int, error) {
	raw := request.URL.Query().Get("limit")
	if raw == "" {
		return defaultLimit, nil
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit < 1 || limit > 200 {
		var collected issues
		collected.add("limit", "must be between 1 and 200")
		return 0, collected.result()
	}
	return limit, nil
}

func ReadIdentifierCursor(request *http.Request) (*uuid.UUID, error) {
	raw := request.URL.Query().Get("cursor")
	if raw == "" {
		return nil, nil
	}
	identifier, err := uuid.Parse(raw)
	if err != nil {
		var collected issues
		collected.add("cursor", "is not valid")
		return nil, collected.result()
	}
	return &identifier, nil
}

func ReadDateRange(request *http.Request, seller dtos.SellerContext, defaultDays int, now time.Time) (services.DateRange, error) {
	var collected issues
	today := now.In(seller.Location)
	to := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, seller.Location)
	from := to.AddDate(0, 0, -(defaultDays - 1))
	if raw := request.URL.Query().Get("from"); raw != "" {
		parsed, err := time.ParseInLocation(time.DateOnly, raw, seller.Location)
		if err != nil {
			collected.add("from", "must be a date like 2026-10-01")
		}
		from = parsed
	}
	if raw := request.URL.Query().Get("to"); raw != "" {
		parsed, err := time.ParseInLocation(time.DateOnly, raw, seller.Location)
		if err != nil {
			collected.add("to", "must be a date like 2026-10-01")
		}
		to = parsed
	}
	if len(collected) == 0 && from.After(to) {
		collected.add("from", "must be on or before to")
	}
	if len(collected) == 0 && to.Sub(from) > 366*24*time.Hour {
		collected.add("from", "the range can cover at most 366 days")
	}
	return services.DateRange{From: from, Until: to.AddDate(0, 0, 1)}, collected.result()
}

func ReadTransactionFilter(request *http.Request, seller dtos.SellerContext) (services.TransactionFilter, error) {
	var collected issues
	filter := services.TransactionFilter{Kind: request.URL.Query().Get("kind")}
	if filter.Kind != "" && !slices.Contains(transactionKinds, filter.Kind) {
		collected.add("kind", "is not a wallet transaction kind")
	}
	for _, name := range []string{"from", "to"} {
		raw := request.URL.Query().Get(name)
		if raw == "" {
			continue
		}
		parsed, err := time.ParseInLocation(time.DateOnly, raw, seller.Location)
		if err != nil {
			collected.add(name, "must be a date like 2026-10-01")
			continue
		}
		if name == "from" {
			filter.From = &parsed
		} else {
			until := parsed.AddDate(0, 0, 1)
			filter.Until = &until
		}
	}
	limit, err := ReadLimit(request, 25)
	if err != nil {
		return filter, err
	}
	filter.Limit = limit
	if filter.Cursor, err = ReadIdentifierCursor(request); err != nil {
		return filter, err
	}
	return filter, collected.result()
}

func ReadMonth(raw string, seller dtos.SellerContext) (time.Time, error) {
	parsed, err := time.ParseInLocation("2006-01", raw, seller.Location)
	if err != nil {
		var collected issues
		collected.add("month", "must be a month like 2026-09")
		return time.Time{}, collected.result()
	}
	return parsed, nil
}

func ReadEscrowStatus(raw string) error {
	if raw != "" && !slices.Contains([]string{"held", "released", "refunded", "disputed"}, raw) {
		var collected issues
		collected.add("status", "must be held, released, refunded or disputed")
		return collected.result()
	}
	return nil
}
