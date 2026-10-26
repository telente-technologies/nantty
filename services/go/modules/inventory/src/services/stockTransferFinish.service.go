package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/enums"
	inventoryerrors "nantty/modules/inventory/src/errors"
	"nantty/modules/inventory/src/events"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
	"nantty/modules/inventory/src/generated/ent/stocktransfer"
	"nantty/modules/inventory/src/generated/ent/stocktransferline"
	"nantty/modules/inventory/src/types"
)

type FinishTransferRequest struct {
	StoreId        uuid.UUID
	TransferId     uuid.UUID
	ActorAccountId uuid.UUID
	IdempotencyKey string
	Receive        bool
	Scope          string
}

func FinishStockTransfer(ctx context.Context, deployed *container.Container, request FinishTransferRequest) (types.StockTransferView, error) {
	actorName := ActorDisplayName(ctx, deployed, request.ActorAccountId)
	return container.RunIdempotently(ctx, deployed, request.Scope, request.IdempotencyKey, container.FingerprintOfRequest(request.TransferId, request.Receive), func(tx *ent.Tx) (types.StockTransferView, error) {
		transfer, err := tx.StockTransfer.Query().Where(stocktransfer.ID(request.TransferId), stocktransfer.StoreID(request.StoreId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return types.StockTransferView{}, inventoryerrors.TransferNotFound
		}
		if err != nil {
			return types.StockTransferView{}, err
		}
		if transfer.Status != enums.TransferInTransit {
			return types.StockTransferView{}, inventoryerrors.TransferAlreadyFinished
		}
		lines, err := tx.StockTransferLine.Query().Where(stocktransferline.TransferID(transfer.ID)).Order(ent.Asc(stocktransferline.FieldVariantID)).All(ctx)
		if err != nil {
			return types.StockTransferView{}, err
		}
		destination, kind, status := transfer.FromLocationID, enums.MovementAdjustment, enums.TransferCancelled
		if request.Receive {
			destination, kind, status = transfer.ToLocationID, enums.MovementTransferIn, enums.TransferReceived
		}
		for _, line := range lines {
			if err := creditTransferLine(ctx, tx, transfer, line, destination, kind, request.ActorAccountId, actorName); err != nil {
				return types.StockTransferView{}, err
			}
		}
		now := deployed.Now()
		update := tx.StockTransfer.UpdateOneID(transfer.ID).SetStatus(status)
		if request.Receive {
			update.SetReceivedAt(now)
		} else {
			update.SetCancelledAt(now)
		}
		transfer, err = update.Save(ctx)
		if err != nil {
			return types.StockTransferView{}, err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "transfer."+status, transfer.ID.String(), now, map[string]any{"transferId": transfer.ID, "storeId": request.StoreId, "reference": transfer.Reference}); err != nil {
			return types.StockTransferView{}, err
		}
		return transferViewWithNames(ctx, deployed, transfer, lines)
	})
}

func creditTransferLine(ctx context.Context, tx *ent.Tx, transfer *ent.StockTransfer, line *ent.StockTransferLine, locationId uuid.UUID, kind string, actorId uuid.UUID, actorName string) error {
	level, err := tx.StockLevel.Query().Where(stocklevel.VariantID(line.VariantID), stocklevel.LocationID(locationId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		source, sourceError := tx.StockLevel.Query().Where(stocklevel.VariantID(line.VariantID), stocklevel.LocationID(transfer.FromLocationID)).Only(ctx)
		if sourceError != nil {
			return sourceError
		}
		level, err = tx.StockLevel.Create().SetStoreID(transfer.StoreID).SetProductID(source.ProductID).SetVariantID(line.VariantID).SetLocationID(locationId).
			SetLowStockLevel(source.LowStockLevel).SetReorderPoint(source.ReorderPoint).SetReorderQuantity(source.ReorderQuantity).SetListed(source.Listed).Save(ctx)
	}
	if err != nil {
		return err
	}
	reason := ""
	if kind == enums.MovementAdjustment {
		reason = "transfer_cancelled"
	}
	_, err = ApplyStockChangeInTransaction(ctx, tx, level, StockChange{
		StoreId: transfer.StoreID, VariantId: line.VariantID, LocationId: locationId, OnHandDelta: line.Quantity, Kind: kind,
		Reference: transfer.Reference, Reason: reason, ActorAccountId: &actorId, ActorName: actorName,
		DedupeKey: MovementDedupeKey(kind, transfer.Reference+reason, line.VariantID, locationId),
	})
	return err
}

func transferViewWithNames(ctx context.Context, deployed *container.Container, transfer *ent.StockTransfer, lines []*ent.StockTransferLine) (types.StockTransferView, error) {
	descriptions, err := DescribeVariantsOfStore(ctx, transfer.StoreID, UniqueVariantIds(lines, func(line *ent.StockTransferLine) uuid.UUID { return line.VariantID }))
	if err != nil {
		return types.StockTransferView{}, err
	}
	view := TransferViewFromRows(transfer, lines, descriptions)
	view.CreatedBy.Name = PeopleNames(ctx, deployed, []uuid.UUID{transfer.CreatedByAccountID})[transfer.CreatedByAccountID]
	return view, nil
}
