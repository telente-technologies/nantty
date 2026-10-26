package liststocktransfers

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/predicate"
	"nantty/modules/inventory/src/generated/ent/stocktransfer"
	"nantty/modules/inventory/src/generated/ent/stocktransferline"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/modules/inventory/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.StockTransferView], error) {
	empty := httpserver.CursorPage[types.StockTransferView]{}
	conditions := []predicate.StockTransfer{stocktransfer.StoreID(query.StoreId)}
	if query.Status != "" {
		conditions = append(conditions, stocktransfer.Status(query.Status))
	}
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return empty, err
	}
	if after != nil {
		conditions = append(conditions, stocktransfer.IDLT(*after))
	}
	rows, err := handler.Container.Client.StockTransfer.Query().Where(conditions...).Order(ent.Desc(stocktransfer.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	transferIds := make([]uuid.UUID, 0, len(rows))
	creators := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		transferIds = append(transferIds, row.ID)
		creators = append(creators, row.CreatedByAccountID)
	}
	lines, err := handler.Container.Client.StockTransferLine.Query().Where(stocktransferline.TransferIDIn(transferIds...)).All(ctx)
	if err != nil {
		return empty, err
	}
	linesByTransfer := map[uuid.UUID][]*ent.StockTransferLine{}
	for _, line := range lines {
		linesByTransfer[line.TransferID] = append(linesByTransfer[line.TransferID], line)
	}
	descriptions, err := services.DescribeVariantsOfStore(ctx, query.StoreId, services.UniqueVariantIds(lines, func(line *ent.StockTransferLine) uuid.UUID { return line.VariantID }))
	if err != nil {
		return empty, err
	}
	names := services.PeopleNames(ctx, handler.Container, creators)
	return utils.PageFromOverfetchedRows(rows, query.Limit, func(row *ent.StockTransfer) types.StockTransferView {
		view := services.TransferViewFromRows(row, linesByTransfer[row.ID], descriptions)
		view.CreatedBy.Name = names[row.CreatedByAccountID]
		return view
	}, func(row *ent.StockTransfer) string { return utils.IdentifierCursor(row.ID) }), nil
}
