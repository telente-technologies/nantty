package services

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
)

func ReleaseReservedStock(ctx context.Context, deployed *container.Container, groupId uuid.UUID) error {
	stock, err := deployed.Stock()
	if err != nil {
		return err
	}
	if err := stock.Release(context.WithoutCancel(ctx), groupId.String()); err != nil {
		return err
	}
	return deployed.Client.OrderGroup.UpdateOneID(groupId).SetStockReserved(false).Exec(context.WithoutCancel(ctx))
}

func releaseReservedStockOrLeaveForSweep(ctx context.Context, deployed *container.Container, groupId uuid.UUID) {
	if err := ReleaseReservedStock(ctx, deployed, groupId); err != nil && deployed.Logger != nil {
		deployed.Logger.WarnContext(ctx, "stock release failed; the stock sweep retries it", slog.String("orderGroupId", groupId.String()), slog.Any("error", err))
	}
}

func ReleaseStockOfClosedOrders(ctx context.Context, deployed *container.Container, batch int) (int, error) {
	rows, err := deployed.Client.OrderGroup.Query().
		Where(ordergroup.StockReserved(true), ordergroup.StatusIn(enums.StatusCancelled, enums.StatusRefunded)).
		Order(ent.Asc(ordergroup.FieldUpdatedAt)).Limit(batch).IDs(ctx)
	if err != nil {
		return 0, err
	}
	released := 0
	for _, groupId := range rows {
		if err := ReleaseReservedStock(ctx, deployed, groupId); err != nil {
			return released, err
		}
		released++
	}
	return released, nil
}
