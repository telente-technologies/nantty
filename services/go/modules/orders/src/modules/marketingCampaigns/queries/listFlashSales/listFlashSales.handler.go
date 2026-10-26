package listflashsales

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/flashsale"
	"nantty/modules/orders/src/modules/marketingCampaigns/dtos"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

const scanBatch = 200

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.FlashSaleView], error) {
	request := handler.Container.Client.FlashSale.Query().Where(flashsale.StoreID(query.StoreId))
	if query.Cursor != "" {
		parts, err := utils.DecodeCursor(query.Cursor, 2)
		if err != nil {
			return httpserver.CursorPage[dtos.FlashSaleView]{}, err
		}
		startsAt, timeError := time.Parse(time.RFC3339Nano, parts[0])
		identifier, idError := uuid.Parse(parts[1])
		if timeError != nil || idError != nil {
			return httpserver.CursorPage[dtos.FlashSaleView]{}, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
		}
		request.Where(flashsale.Or(flashsale.StartsAtLT(startsAt), flashsale.And(flashsale.StartsAt(startsAt), flashsale.IDLT(identifier))))
	}
	rows, err := request.Order(ent.Desc(flashsale.FieldStartsAt), ent.Desc(flashsale.FieldID)).Limit(scanBatch).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.FlashSaleView]{}, err
	}
	now := handler.Container.Now()
	kept := make([]*ent.FlashSale, 0, query.Limit+1)
	for _, row := range rows {
		if query.Status == "" || services.FlashSaleStatus(row, now) == query.Status {
			kept = append(kept, row)
		}
		if len(kept) > query.Limit {
			break
		}
	}
	nextCursor := ""
	if len(kept) > query.Limit {
		kept = kept[:query.Limit]
		last := kept[len(kept)-1]
		nextCursor = utils.EncodeCursor(last.StartsAt.UTC().Format(time.RFC3339Nano), last.ID.String())
	} else if len(rows) == scanBatch {
		last := rows[len(rows)-1]
		nextCursor = utils.EncodeCursor(last.StartsAt.UTC().Format(time.RFC3339Nano), last.ID.String())
	}
	views, err := services.PresentFlashSales(ctx, handler.Container, kept)
	return httpserver.NewCursorPage(views, nextCursor), err
}
