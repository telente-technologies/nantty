package createstocktransfer

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/enums"
	inventoryerrors "nantty/modules/inventory/src/errors"
	"nantty/modules/inventory/src/events"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
	"nantty/modules/inventory/src/generated/ent/stocktransfer"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.StockTransferView, error) {
	request := command.Request
	fromId, toId := uuid.MustParse(request.FromLocationId), uuid.MustParse(request.ToLocationId)
	for _, locationId := range []uuid.UUID{fromId, toId} {
		location, err := services.ResolveLocationOfStore(ctx, handler.Container, command.Store.StoreId, &locationId)
		if err != nil || !location.Active {
			return types.StockTransferView{}, inventoryerrors.InvalidStockLocation
		}
	}
	variantIds := make([]uuid.UUID, 0, len(request.Lines))
	for _, line := range request.Lines {
		variantIds = append(variantIds, uuid.MustParse(line.VariantId))
	}
	descriptions, err := services.DescribeVariantsOfStore(ctx, command.Store.StoreId, variantIds)
	if err != nil {
		return types.StockTransferView{}, err
	}
	for _, variantId := range variantIds {
		if _, found := descriptions[variantId]; !found {
			return types.StockTransferView{}, inventoryerrors.VariantNotFound
		}
	}
	actorName := services.ActorDisplayName(ctx, handler.Container, command.ActorAccountId)
	scope, fingerprint := "transfers:"+command.Store.StoreId.String(), container.FingerprintOfRequest(request)
	for attempt := 0; attempt < 5; attempt++ {
		view, err := container.RunIdempotently(ctx, handler.Container, scope, command.IdempotencyKey, fingerprint, func(tx *ent.Tx) (types.StockTransferView, error) {
			transfer, err := handler.create(ctx, tx, command, fromId, toId, actorName)
			if err != nil {
				return types.StockTransferView{}, err
			}
			view := services.TransferViewFromRows(transfer, linesOf(ctx, tx, transfer), descriptions)
			view.CreatedBy.Name = actorName
			return view, nil
		})
		if !ent.IsConstraintError(err) {
			return view, err
		}
	}
	return types.StockTransferView{}, inventoryerrors.TransferAlreadyFinished
}

func linesOf(ctx context.Context, tx *ent.Tx, transfer *ent.StockTransfer) []*ent.StockTransferLine {
	lines, _ := tx.StockTransferLine.Query().Where(transferLineOf(transfer.ID)).All(ctx)
	return lines
}

func (handler Handler) create(ctx context.Context, tx *ent.Tx, command Command, fromId, toId uuid.UUID, actorName string) (*ent.StockTransfer, error) {
	reference, err := nextTransferReference(ctx, tx, command.Store.StoreId)
	if err != nil {
		return nil, err
	}
	note := ""
	if command.Request.Note != nil {
		note = *command.Request.Note
	}
	transfer, err := tx.StockTransfer.Create().SetStoreID(command.Store.StoreId).SetReference(reference).SetFromLocationID(fromId).SetToLocationID(toId).
		SetNote(note).SetCreatedByAccountID(command.ActorAccountId).Save(ctx)
	if err != nil {
		return nil, err
	}
	lines := append([]struct {
		VariantId uuid.UUID
		Quantity  int
	}{}, linePairs(command)...)
	sort.Slice(lines, func(left, right int) bool { return lines[left].VariantId.String() < lines[right].VariantId.String() })
	for _, line := range lines {
		level, err := tx.StockLevel.Query().Where(stocklevel.VariantID(line.VariantId), stocklevel.LocationID(fromId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return nil, inventoryerrors.InsufficientStock
		}
		if err != nil {
			return nil, err
		}
		if _, err := services.ApplyStockChangeInTransaction(ctx, tx, level, services.StockChange{
			StoreId: command.Store.StoreId, VariantId: line.VariantId, LocationId: fromId, OnHandDelta: -line.Quantity, Kind: enums.MovementTransferOut,
			Reference: reference, Note: note, ActorAccountId: &command.ActorAccountId, ActorName: actorName,
			DedupeKey: services.MovementDedupeKey(enums.MovementTransferOut, reference, line.VariantId, fromId),
		}); err != nil {
			return nil, err
		}
		if err := tx.StockTransferLine.Create().SetTransferID(transfer.ID).SetVariantID(line.VariantId).SetQuantity(line.Quantity).Exec(ctx); err != nil {
			return nil, err
		}
	}
	err = events.EnqueueOutboxEventInTransaction(ctx, tx, "transfer.created", transfer.ID.String(), handler.Container.Now(), map[string]any{
		"transferId": transfer.ID, "storeId": command.Store.StoreId, "reference": reference, "fromLocationId": fromId, "toLocationId": toId,
	})
	return transfer, err
}

func nextTransferReference(ctx context.Context, tx *ent.Tx, storeId uuid.UUID) (string, error) {
	latest, err := tx.StockTransfer.Query().Where(stocktransfer.StoreID(storeId)).Order(ent.Desc(stocktransfer.FieldReference)).First(ctx)
	if ent.IsNotFound(err) {
		return "TRF-0001", nil
	}
	if err != nil {
		return "", err
	}
	number, _ := strconv.Atoi(strings.TrimPrefix(latest.Reference, "TRF-"))
	return fmt.Sprintf("TRF-%04d", number+1), nil
}
