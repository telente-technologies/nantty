package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/currency/internal/catalog"
	"zudomart/modules/currency/internal/ent"
	"zudomart/modules/currency/internal/ent/exchangeraterevision"
	"zudomart/modules/currency/internal/rates"
)

const historyPageSize = 50

type CurrencyView struct {
	Code       string `json:"code"`
	Name       string `json:"name"`
	MinorUnits int    `json:"minorUnits"`
	UsdRateE8  int64  `json:"usdRateE8"`
	Rate       string `json:"rate"`
	UpdatedAt  string `json:"updatedAt"`
}

type RevisionView struct {
	Id        string `json:"id"`
	Currency  string `json:"currency"`
	UsdRateE8 int64  `json:"usdRateE8"`
	Rate      string `json:"rate"`
	Source    string `json:"source"`
	SetBy     string `json:"setBy"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"createdAt"`
}

type RevisionsPage struct {
	Data       []RevisionView `json:"data"`
	NextCursor *string        `json:"nextCursor"`
}

func (application *CurrencyApplication) latestRevisionForCurrency(ctx context.Context, client *ent.Client, code string) (*ent.ExchangeRateRevision, error) {
	return client.ExchangeRateRevision.Query().Where(exchangeraterevision.Currency(code)).Order(ent.Desc(exchangeraterevision.FieldID)).First(ctx)
}

func (application *CurrencyApplication) CurrentUsdRateE8(ctx context.Context, code string) (int64, error) {
	if _, supported := catalog.FindSupportedCurrency(code); !supported {
		return 0, errUnsupportedCurrency
	}
	latest, err := application.latestRevisionForCurrency(ctx, application.Client, code)
	if err != nil {
		return 0, err
	}
	return latest.UsdRateE8, nil
}

func (application *CurrencyApplication) ListSupportedCurrenciesWithCurrentRates(ctx context.Context) ([]CurrencyView, error) {
	supported := catalog.SupportedCurrencies()
	views := make([]CurrencyView, 0, len(supported))
	for _, currency := range supported {
		latest, err := application.latestRevisionForCurrency(ctx, application.Client, currency.Code)
		if err != nil {
			return nil, err
		}
		views = append(views, CurrencyView{
			Code: currency.Code, Name: currency.Name, MinorUnits: currency.MinorUnits, UsdRateE8: latest.UsdRateE8,
			Rate: rates.FormatE8AsDecimal(latest.UsdRateE8), UpdatedAt: latest.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	return views, nil
}

func (application *CurrencyApplication) ListExchangeRateHistory(ctx context.Context, currency, cursor string) (RevisionsPage, error) {
	query := application.Client.ExchangeRateRevision.Query().Order(ent.Desc(exchangeraterevision.FieldID)).Limit(historyPageSize + 1)
	if currency != "" {
		if _, supported := catalog.FindSupportedCurrency(currency); !supported {
			return RevisionsPage{}, errUnsupportedCurrency
		}
		query = query.Where(exchangeraterevision.Currency(currency))
	}
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return RevisionsPage{}, unprocessable("INVALID_CURSOR", "The cursor is invalid.")
		}
		query = query.Where(exchangeraterevision.IDLT(cursorId))
	}
	rows, err := query.All(ctx)
	if err != nil {
		return RevisionsPage{}, err
	}
	page := RevisionsPage{Data: make([]RevisionView, 0, len(rows))}
	if len(rows) > historyPageSize {
		rows = rows[:historyPageSize]
		next := rows[len(rows)-1].ID.String()
		page.NextCursor = &next
	}
	for _, row := range rows {
		page.Data = append(page.Data, convertRevisionToView(row))
	}
	return page, nil
}

func convertRevisionToView(row *ent.ExchangeRateRevision) RevisionView {
	return RevisionView{
		Id: row.ID.String(), Currency: row.Currency, UsdRateE8: row.UsdRateE8, Rate: rates.FormatE8AsDecimal(row.UsdRateE8),
		Source: string(row.Source), SetBy: row.SetBy, Reason: row.Reason, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
	}
}
