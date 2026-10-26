package listexchangeratehistory

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/currency/src/constants"
	"nantty/modules/currency/src/container"
	currencyerrors "nantty/modules/currency/src/errors"
	"nantty/modules/currency/src/generated/ent"
	"nantty/modules/currency/src/generated/ent/exchangeraterevision"
	"nantty/modules/currency/src/modules/exchangeRates/models"
)

const historyPageSize = 50

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	rows := handler.Container.Client.ExchangeRateRevision.Query().Order(ent.Desc(exchangeraterevision.FieldID)).Limit(historyPageSize + 1)
	if query.Currency != "" {
		if _, supported := constants.FindSupportedCurrency(query.Currency); !supported {
			return Result{}, currencyerrors.UnsupportedCurrency
		}
		rows = rows.Where(exchangeraterevision.Currency(query.Currency))
	}
	if query.Cursor != "" {
		cursorId, err := uuid.Parse(query.Cursor)
		if err != nil {
			return Result{}, currencyerrors.Unprocessable("INVALID_CURSOR", "The cursor is invalid.")
		}
		rows = rows.Where(exchangeraterevision.IDLT(cursorId))
	}
	found, err := rows.All(ctx)
	if err != nil {
		return Result{}, err
	}
	page := Result{Data: make([]models.RevisionView, 0, len(found))}
	if len(found) > historyPageSize {
		found = found[:historyPageSize]
		next := found[len(found)-1].ID.String()
		page.NextCursor = &next
	}
	for _, row := range found {
		page.Data = append(page.Data, models.ConvertRevisionToView(row))
	}
	return page, nil
}
