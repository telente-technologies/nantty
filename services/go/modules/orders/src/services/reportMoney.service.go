package services

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

const maximumSourcePages = 20

var reportSourceClient = &http.Client{Timeout: 10 * time.Second}

type sourcePage struct {
	Data       []json.RawMessage `json:"data"`
	NextCursor *string           `json:"nextCursor"`
}

func internalGet(ctx context.Context, baseUrl, path, token string, headers map[string]string, target any) error {
	if baseUrl == "" {
		return ordererrors.ReportUnavailable
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, baseUrl+path, nil)
	if err != nil {
		return err
	}
	request.Header.Set("X-Internal-Token", token)
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	response, err := reportSourceClient.Do(request)
	if err != nil {
		return ordererrors.ReportUnavailable
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if err != nil || response.StatusCode != http.StatusOK || json.Unmarshal(body, target) != nil {
		return ordererrors.ReportUnavailable
	}
	return nil
}

func sellerMoneyGet(ctx context.Context, deployed *container.Container, store commerceports.StoreAccess, actorId uuid.UUID, suffix string, query url.Values, target any) error {
	path := "/api/v1/internal/sellers/" + store.OwnerAccountId.String() + suffix
	if len(query) > 0 {
		path += "?" + query.Encode()
	}
	return internalGet(ctx, deployed.Settings.MoneyInternalUrl, path, deployed.Settings.MoneyInternalToken, map[string]string{
		"X-Seller-Store-Id": store.StoreId.String(), "X-Store-Currency": string(store.Currency), "X-Store-Country": store.CountryCode,
		"X-Store-Timezone": store.Timezone, "X-Store-Name": store.StoreName, "X-Actor-Id": actorId.String(),
	}, target)
}

func collectSellerMoneyPages[Row any](ctx context.Context, deployed *container.Container, store commerceports.StoreAccess, actorId uuid.UUID, suffix string, query url.Values) ([]Row, error) {
	rows := []Row{}
	for page := 0; page < maximumSourcePages; page++ {
		var fetched sourcePage
		if err := sellerMoneyGet(ctx, deployed, store, actorId, suffix, query, &fetched); err != nil {
			return nil, err
		}
		for _, raw := range fetched.Data {
			var row Row
			if json.Unmarshal(raw, &row) == nil {
				rows = append(rows, row)
			}
		}
		if fetched.NextCursor == nil || *fetched.NextCursor == "" {
			break
		}
		query.Set("cursor", *fetched.NextCursor)
	}
	return rows, nil
}

func (data ReportData) dayInRange(stamp string) (string, bool) {
	if len(stamp) < 10 {
		return "", false
	}
	day := stamp[:10]
	return day, day >= data.From.Format(time.DateOnly) && day <= data.To.Format(time.DateOnly)
}

func sumMoney(currency money.CurrencyCode, values ...money.Money) money.Money {
	total := money.Money{Currency: currency}
	for _, value := range values {
		total.AmountMinor += value.AmountMinor
	}
	return total
}

type settlementSource struct {
	Reference   string      `json:"reference"`
	OrdersCount int         `json:"ordersCount"`
	Gross       money.Money `json:"gross"`
	Fees        money.Money `json:"fees"`
	Net         money.Money `json:"net"`
	Status      string      `json:"status"`
	SettledAt   string      `json:"settledAt"`
}

func settlementsReport(ctx context.Context, deployed *container.Container, data ReportData, store commerceports.StoreAccess, actorId uuid.UUID) (ReportResult, error) {
	result := data.base("settlements", "Settlements", []ReportColumn{{"reference", "Reference", "text"}, {"settledAt", "Settled", "date"}, {"orders", "Orders", "number"},
		{"gross", "Gross", "money"}, {"fees", "Fees", "money"}, {"net", "Net", "money"}, {"status", "Status", "text"}})
	rows, err := collectSellerMoneyPages[settlementSource](ctx, deployed, store, actorId, "/finance/settlements", url.Values{"limit": {"50"}})
	if err != nil {
		return result, err
	}
	var orders int
	var gross, fees, net []money.Money
	for _, row := range rows {
		day, inRange := data.dayInRange(row.SettledAt)
		if !inRange {
			continue
		}
		result.Rows = append(result.Rows, map[string]any{"reference": row.Reference, "settledAt": day, "orders": row.OrdersCount, "gross": row.Gross, "fees": row.Fees, "net": row.Net, "status": row.Status})
		orders, gross, fees, net = orders+row.OrdersCount, append(gross, row.Gross), append(fees, row.Fees), append(net, row.Net)
	}
	result.Totals = map[string]any{"reference": "Total", "orders": orders, "gross": sumMoney(data.Currency, gross...), "fees": sumMoney(data.Currency, fees...), "net": sumMoney(data.Currency, net...)}
	return result, nil
}

func feesReport(ctx context.Context, deployed *container.Container, data ReportData, store commerceports.StoreAccess, actorId uuid.UUID) (ReportResult, error) {
	result := data.base("fees", "Fees", []ReportColumn{{"fee", "Fee", "text"}, {"rate", "Rate", "percent"}, {"count", "Count", "number"}, {"amount", "Amount", "money"}, {"shareOfSales", "Share of sales", "percent"}})
	var breakdown struct {
		GrossSales money.Money `json:"grossSales"`
		TotalFees  money.Money `json:"totalFees"`
		Lines      []struct {
			Label           string      `json:"label"`
			RateBasisPoints *int        `json:"rateBasisPoints"`
			Count           int         `json:"count"`
			Amount          money.Money `json:"amount"`
		} `json:"lines"`
	}
	query := url.Values{"from": {data.From.Format(time.DateOnly)}, "to": {data.To.Format(time.DateOnly)}}
	if err := sellerMoneyGet(ctx, deployed, store, actorId, "/finance/fees", query, &breakdown); err != nil {
		return result, err
	}
	for _, line := range breakdown.Lines {
		var rate any
		if line.RateBasisPoints != nil {
			rate = int64(*line.RateBasisPoints)
		}
		result.Rows = append(result.Rows, map[string]any{"fee": line.Label, "rate": rate, "count": line.Count, "amount": line.Amount, "shareOfSales": basisPoints(line.Amount.AmountMinor, breakdown.GrossSales.AmountMinor)})
	}
	result.Totals = map[string]any{"fee": "Total", "amount": breakdown.TotalFees, "shareOfSales": basisPoints(breakdown.TotalFees.AmountMinor, breakdown.GrossSales.AmountMinor)}
	return result, nil
}
