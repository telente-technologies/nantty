package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/databases/schema"
	"zudomart/modules/orders/src/enums"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/orderitem"
	"zudomart/modules/orders/src/generated/ent/returnrequest"
	"zudomart/platform/commerceports"
)

func ReturnRefundMinor(items map[uuid.UUID]*ent.OrderItem, lines []schema.ReturnLine, discountRatioNumerator, discountRatioDenominator int64) (int64, bool) {
	var total int64
	seen := map[string]bool{}
	for _, line := range lines {
		identifier, err := uuid.Parse(line.OrderItemId)
		item := items[identifier]
		if err != nil || item == nil || line.Quantity < 1 || line.Quantity > item.Quantity || seen[line.OrderItemId] {
			return 0, false
		}
		seen[line.OrderItemId] = true
		total += item.UnitPriceMinor * int64(line.Quantity)
	}
	if discountRatioDenominator > 0 {
		total = total * discountRatioNumerator / discountRatioDenominator
	}
	return total, total > 0
}

func RequestReturn(ctx context.Context, deployed *container.Container, buyerId, orderId uuid.UUID, lines []schema.ReturnLine, reason string) (*ent.ReturnRequest, error) {
	var created *ent.ReturnRequest
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		group, err := LockOrderGroup(ctx, tx, orderId)
		if err != nil || group.BuyerAccountID != buyerId {
			return firstFailure(err, ordererrors.OrderNotFound)
		}
		open, err := tx.ReturnRequest.Query().Where(returnrequest.OrderGroupID(orderId), returnrequest.StatusIn("requested", "approved")).Exist(ctx)
		if err != nil {
			return err
		}
		if open || (group.Status != enums.StatusDelivered && group.Status != enums.StatusCompleted) {
			return ordererrors.ReturnNotAllowed
		}
		rows, err := tx.OrderItem.Query().Where(orderitem.OrderGroupID(orderId)).All(ctx)
		if err != nil {
			return err
		}
		items := map[uuid.UUID]*ent.OrderItem{}
		for _, row := range rows {
			items[row.ID] = row
		}
		paidItems := group.SubtotalMinor - group.DiscountMinor - group.StoreCreditMinor
		refund, valid := ReturnRefundMinor(items, lines, paidItems, group.SubtotalMinor)
		if !valid {
			return ordererrors.ReturnLinesInvalid
		}
		created, err = tx.ReturnRequest.Create().SetOrderGroupID(orderId).SetStoreID(group.StoreID).SetBuyerAccountID(buyerId).SetReason(reason).SetRefundAmountMinor(refund).
			SetCurrency(group.Currency).SetLines(lines).Save(ctx)
		if err != nil {
			return err
		}
		if err := AppendTimelineEvent(ctx, tx, orderId, "note", "The buyer asked to return items", OrderActor{Kind: enums.ActorBuyer, AccountId: &buyerId, Name: group.BuyerName}); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "return.requested", created.ID.String(), deployed.Now(), map[string]any{
			"returnId": created.ID, "orderGroupId": orderId, "storeId": group.StoreID, "buyerAccountId": buyerId, "refundAmountMinor": refund, "currency": group.Currency,
		})
	})
	return created, err
}

func DecideReturn(ctx context.Context, deployed *container.Container, seller SellerContext, returnId uuid.UUID, approve bool, note string) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := lockStoreReturn(ctx, tx, seller.Store.StoreId, returnId)
		if err != nil {
			return err
		}
		if row.Status != "requested" {
			return ordererrors.ReturnStateConflict
		}
		update := tx.ReturnRequest.UpdateOneID(row.ID)
		kind, summary := "note", "The seller approved the return"
		if approve {
			update.SetStatus("approved")
		} else {
			update.SetStatus("declined").SetDeclineNote(note)
			summary = "The seller declined the return"
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		if err := AppendTimelineEvent(ctx, tx, row.OrderGroupID, kind, summary, seller.actor()); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "return.decided", row.ID.String(), deployed.Now(), map[string]any{"returnId": row.ID, "approved": approve, "storeId": row.StoreID})
	})
}

func lockStoreReturn(ctx context.Context, tx *ent.Tx, storeId, returnId uuid.UUID) (*ent.ReturnRequest, error) {
	row, err := tx.ReturnRequest.Query().Where(returnrequest.ID(returnId), returnrequest.StoreID(storeId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ordererrors.ReturnNotFound
	}
	return row, err
}

func ReceiveReturn(ctx context.Context, deployed *container.Container, seller SellerContext, returnId uuid.UUID, restockLocation *uuid.UUID) error {
	var restock []commerceports.StockLine
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := lockStoreReturn(ctx, tx, seller.Store.StoreId, returnId)
		if err != nil {
			return err
		}
		if row.Status != "approved" {
			return ordererrors.ReturnStateConflict
		}
		group, err := LockOrderGroup(ctx, tx, row.OrderGroupID)
		if err != nil {
			return err
		}
		now := deployed.Now()
		if group.Status != enums.StatusReturned {
			if group, err = TransitionOrderGroup(ctx, tx, group, Transition{To: enums.StatusReturned, Summary: "Returned items were received by the seller", Actor: seller.actor(),
				Customize: func(update *ent.OrderGroupUpdateOne) { update.SetRefundRequestedAt(now) }}, now); err != nil {
				return err
			}
		}
		if restockLocation != nil {
			if restock, err = restockLines(ctx, tx, row); err != nil {
				return err
			}
		}
		if err := tx.ReturnRequest.UpdateOneID(row.ID).SetStatus("refunded").SetRestocked(restockLocation != nil).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "orderGroup.refundRequested", group.ID.String(), now, map[string]any{
			"orderGroupId": group.ID, "storeId": group.StoreID, "buyerAccountId": group.BuyerAccountID, "amountMinor": row.RefundAmountMinor, "currency": row.Currency,
			"reason": fmt.Sprintf("return:%s", row.ID),
		})
	})
	if err != nil || restockLocation == nil || len(restock) == 0 {
		return err
	}
	stock, err := deployed.Stock()
	if err != nil {
		return err
	}
	return stock.Restock(ctx, commerceports.RestockRequest{Reference: "return:" + returnId.String(), StoreId: seller.Store.StoreId, LocationId: *restockLocation, Lines: restock, ActorName: seller.Name})
}

func restockLines(ctx context.Context, tx *ent.Tx, row *ent.ReturnRequest) ([]commerceports.StockLine, error) {
	items, err := tx.OrderItem.Query().Where(orderitem.OrderGroupID(row.OrderGroupID)).All(ctx)
	if err != nil {
		return nil, err
	}
	byId := map[string]*ent.OrderItem{}
	for _, item := range items {
		byId[item.ID.String()] = item
	}
	lines := []commerceports.StockLine{}
	for _, line := range row.Lines {
		if item := byId[line.OrderItemId]; item != nil && item.TracksStock {
			lines = append(lines, commerceports.StockLine{VariantId: item.VariantID, StoreId: item.StoreID, Quantity: line.Quantity})
		}
	}
	return lines, nil
}
