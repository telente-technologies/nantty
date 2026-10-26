package applystockadjustments

import (
	"context"
	"sort"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/enums"
	inventoryerrors "nantty/modules/inventory/src/errors"
	"nantty/modules/inventory/src/events"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
	"nantty/modules/inventory/src/modules/adjustments/dtos"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (httpserver.CursorPage[types.StockAdjustmentView], error) {
	request := command.Request
	locationId := uuid.MustParse(request.LocationId)
	location, err := services.ResolveLocationOfStore(ctx, handler.Container, command.Store.StoreId, &locationId)
	if err != nil {
		return httpserver.CursorPage[types.StockAdjustmentView]{}, err
	}
	variantIds := make([]uuid.UUID, 0, len(request.Lines))
	for _, line := range request.Lines {
		variantIds = append(variantIds, uuid.MustParse(line.VariantId))
	}
	descriptions, err := services.DescribeVariantsOfStore(ctx, command.Store.StoreId, variantIds)
	if err != nil {
		return httpserver.CursorPage[types.StockAdjustmentView]{}, err
	}
	for _, variantId := range variantIds {
		if _, found := descriptions[variantId]; !found {
			return httpserver.CursorPage[types.StockAdjustmentView]{}, inventoryerrors.VariantNotFound
		}
	}
	actorName := services.ActorDisplayName(ctx, handler.Container, command.ActorAccountId)
	scope := "adjustments:" + command.Store.StoreId.String()
	fingerprint := container.FingerprintOfRequest(request)
	return container.RunIdempotently(ctx, handler.Container, scope, command.IdempotencyKey, fingerprint, func(tx *ent.Tx) (httpserver.CursorPage[types.StockAdjustmentView], error) {
		return handler.apply(ctx, tx, command, location, descriptions, actorName)
	})
}

func (handler Handler) apply(ctx context.Context, tx *ent.Tx, command Command, location *ent.StockLocation, descriptions map[uuid.UUID]commerceports.VariantDescription, actorName string) (httpserver.CursorPage[types.StockAdjustmentView], error) {
	request := command.Request
	lines := sortedAdjustmentLines(request)
	batchId := uuid.New()
	note := ""
	if request.Note != nil {
		note = *request.Note
	}
	now := handler.Container.Now()
	views := make([]types.StockAdjustmentView, 0, len(lines))
	for _, line := range lines {
		level, err := tx.StockLevel.Query().Where(stocklevel.VariantID(line.VariantId), stocklevel.LocationID(location.ID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			level, err = tx.StockLevel.Create().SetStoreID(command.Store.StoreId).SetProductID(descriptions[line.VariantId].ProductId).SetVariantID(line.VariantId).
				SetLocationID(location.ID).SetListed(descriptions[line.VariantId].TracksStock).Save(ctx)
		}
		if err != nil {
			return httpserver.CursorPage[types.StockAdjustmentView]{}, err
		}
		updated, err := services.ApplyStockChangeInTransaction(ctx, tx, level, services.StockChange{
			StoreId: command.Store.StoreId, VariantId: line.VariantId, LocationId: location.ID, OnHandDelta: line.Delta, Kind: enums.MovementAdjustment,
			Reference: request.Reason, Reason: request.Reason, Note: note, ActorAccountId: &command.ActorAccountId, ActorName: actorName,
			AllowBelowReserved: request.Reason == "count",
		})
		if err != nil {
			return httpserver.CursorPage[types.StockAdjustmentView]{}, err
		}
		row, err := tx.StockAdjustment.Create().SetStoreID(command.Store.StoreId).SetLocationID(location.ID).SetVariantID(line.VariantId).SetBatchID(batchId).
			SetReason(request.Reason).SetNote(note).SetQuantityDelta(line.Delta).SetQuantityBefore(level.OnHand).SetQuantityAfter(updated.OnHand).
			SetActorAccountID(command.ActorAccountId).SetActorName(actorName).Save(ctx)
		if err != nil {
			return httpserver.CursorPage[types.StockAdjustmentView]{}, err
		}
		views = append(views, services.AdjustmentView(row, descriptions[line.VariantId]))
	}
	err := events.EnqueueOutboxEventInTransaction(ctx, tx, "stock.adjusted", batchId.String(), now, map[string]any{
		"batchId": batchId, "storeId": command.Store.StoreId, "locationId": location.ID, "reason": request.Reason, "lines": request.Lines,
	})
	return httpserver.NewCursorPage(views, ""), err
}

type adjustmentLine struct {
	VariantId uuid.UUID
	Delta     int
}

func sortedAdjustmentLines(request dtos.AdjustmentRequest) []adjustmentLine {
	lines := make([]adjustmentLine, 0, len(request.Lines))
	for _, line := range request.Lines {
		lines = append(lines, adjustmentLine{VariantId: uuid.MustParse(line.VariantId), Delta: line.QuantityDelta})
	}
	sort.Slice(lines, func(left, right int) bool { return lines[left].VariantId.String() < lines[right].VariantId.String() })
	return lines
}
