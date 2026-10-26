package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/affiliateattributedsale"
	"nantty/modules/creators/src/generated/ent/affiliatecommission"
	"nantty/modules/creators/src/generated/ent/affiliateproductcommission"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/creators/src/repositories"
)

func (affiliates Affiliates) CreditCommissionsForRelease(ctx context.Context, sale AffiliateSaleReleased) (int, error) {
	credited := 0
	err := affiliates.forEachAttributedCreator(ctx, &sale, func(item attributedSale, creatorId string, labels saleLabels) error {
		ok, err := affiliates.creditOne(ctx, sale, item, creatorId, labels)
		if ok {
			credited++
		}
		return err
	})
	return credited, err
}

func (affiliates Affiliates) creditOne(ctx context.Context, sale AffiliateSaleReleased, item attributedSale, creatorId string, labels saleLabels) (bool, error) {
	credited := false
	err := affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
		if err := lockAttributedItem(ctx, transaction, item); err != nil {
			return err
		}
		if exists, err := client.AffiliateCommission.Query().Where(affiliatecommission.OrderItemID(item.itemKey)).Exist(ctx); err != nil || exists {
			return err
		}
		bps, eligible, err := affiliates.eligibleRate(ctx, transaction, client, sale, item, creatorId)
		if err != nil {
			return err
		}
		amount := ShareOf(item.amountMinor, bps)
		now := affiliates.Container.Now().UTC()
		if !eligible || amount <= 0 {
			return voidAttributedSale(ctx, client, item.itemKey, "ineligible", now)
		}
		commission, err := client.AffiliateCommission.Create().SetID(uuid.Must(uuid.NewV7())).SetOrderID(sale.OrderId).SetOrderNumber(sale.OrderNumber).SetOrderItemID(item.itemKey).SetProductID(item.productId).
			SetStoreID(sale.StoreId).SetSellerUserID(sale.SellerUserId).SetCreatorID(creatorId).SetAttributionSource(item.source).SetAttributionID(item.sourceId).
			SetSaleMinor(item.amountMinor).SetCommissionBps(bps).SetCommissionMinor(amount).SetCurrency(sale.Currency).SetNillableOrderedAt(sale.OrderedAt).
			SetProductName(truncateLabel(labels.productName, 200)).SetStoreName(truncateLabel(labels.storeName, 200)).SetCreatorHandle(truncateLabel(labels.creatorHandle, 80)).
			SetStatus(affiliatecommission.StatusPending).SetCreatedAt(now).Save(ctx)
		if err != nil {
			return err
		}
		if err := completeAttributedSale(ctx, client, sale, item, creatorId, labels, bps, amount, now); err != nil {
			return err
		}
		if _, err := affiliates.settleCommissionInTransaction(ctx, transaction, client, commission); err != nil {
			return err
		}
		if _, err := programservices.RecordEarning(ctx, client, programservices.Earning{
			CreatorId: creatorId, Kind: "affiliate", Reference: "affiliate-commission:" + item.itemKey, SourceType: item.source, SourceId: item.sourceId,
			Description: CreatorCommissionCreditDescription(commission), GrossMinor: item.amountMinor, NetMinor: amount, Unit: sale.Currency, At: now,
		}); err != nil {
			return err
		}
		credited = true
		return affiliates.Container.Outbox.EnqueueInTransaction(ctx, transaction, "affiliateCommission.credited", creatorId, now, map[string]any{
			"commissionId": commission.ID.String(), "creatorId": creatorId, "orderId": sale.OrderId, "productId": item.productId, "storeId": sale.StoreId,
			"commission": Money{amount, sale.Currency},
		})
	})
	return credited, err
}

type CommissionLedgerEntryView struct {
	Id              string     `json:"id"`
	OrderNumber     string     `json:"orderNumber"`
	CreatorId       string     `json:"creatorId"`
	CreatorUsername string     `json:"creatorUsername"`
	OrderTotal      Money      `json:"orderTotal"`
	Commission      Money      `json:"commission"`
	Status          string     `json:"status"`
	OrderedAt       time.Time  `json:"orderedAt"`
	EscrowReleaseAt *time.Time `json:"escrowReleaseAt"`
	PaidAt          *time.Time `json:"paidAt"`
}

func (affiliates Affiliates) CommissionLedger(ctx context.Context, store repositories.StoreSummary, status, cursor string, limit int) ([]CommissionLedgerEntryView, string, error) {
	query := affiliates.Container.Client(affiliates.Container.Resources.Database).AffiliateCommission.Query().Where(affiliatecommission.StoreID(store.Id))
	switch status {
	case "paid", "reversed":
		query.Where(affiliatecommission.StatusEQ(affiliatecommission.Status(status)))
	case "owed":
		query.Where(affiliatecommission.StatusIn(affiliatecommission.StatusPending, affiliatecommission.StatusProcessing))
	}
	if before, err := uuid.Parse(cursor); err == nil {
		query.Where(affiliatecommission.IDLT(before))
	}
	rows, err := query.Order(ent.Desc(affiliatecommission.FieldID)).Limit(limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(rows) > limit {
		rows, next = rows[:limit], rows[limit-1].ID.String()
	}
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.CreatorID)
	}
	users, err := affiliates.Container.Directory.FindUserSummaries(ctx, ids)
	if err != nil {
		return nil, "", err
	}
	views := make([]CommissionLedgerEntryView, 0, len(rows))
	for _, row := range rows {
		orderedAt := row.CreatedAt
		if row.OrderedAt != nil {
			orderedAt = *row.OrderedAt
		}
		views = append(views, CommissionLedgerEntryView{
			Id: row.ID.String(), OrderNumber: row.OrderNumber, CreatorId: row.CreatorID, CreatorUsername: users[row.CreatorID].Username,
			OrderTotal: Money{row.SaleMinor, row.Currency}, Commission: Money{row.CommissionMinor, row.Currency}, Status: row.Status.String(),
			OrderedAt: orderedAt, EscrowReleaseAt: row.PaidAt, PaidAt: row.PaidAt,
		})
	}
	return views, next, nil
}

func (affiliates Affiliates) rateFor(ctx context.Context, client *ent.Client, storeId string, item attributedSale) (int64, error) {
	if item.lockedBps != nil {
		return min(max(*item.lockedBps, 0), affiliates.MaximumBps()), nil
	}
	// The awaiting-sale row is written when the order is paid, so its rate is the one the buyer saw at checkout.
	// Prefer it over the current settings: a seller lowering their rate before escrow release must not cut an
	// already-attributed commission.
	awaiting, err := client.AffiliateAttributedSale.Query().Where(affiliateattributedsale.OrderItemID(item.itemKey)).Only(ctx)
	if err == nil {
		return min(max(awaiting.CommissionBps, 0), affiliates.MaximumBps()), nil
	}
	if !ent.IsNotFound(err) {
		return 0, err
	}
	settings, err := affiliates.settingsRow(ctx, client, storeId)
	if err != nil || settings == nil || !settings.Enabled {
		return 0, err
	}
	override, err := client.AffiliateProductCommission.Query().Where(affiliateproductcommission.StoreID(storeId), affiliateproductcommission.ProductID(item.productId)).Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return 0, err
	}
	return EffectiveBps(settings.DefaultCommissionBps, override, affiliates.MaximumBps()), nil
}
