package services

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/creators/src/generated/ent"
	"zudomart/modules/creators/src/generated/ent/affiliatecommission"
	"zudomart/modules/creators/src/generated/ent/affiliateproductcommission"
	"zudomart/modules/creators/src/generated/ent/creatoraffiliation"
	programservices "zudomart/modules/creators/src/modules/creatorProgram/services"
	"zudomart/modules/creators/src/repositories"
)

type AttributedItem struct {
	OrderItemId       string `json:"orderItemId"`
	ProductId         string `json:"productId"`
	VariantId         string `json:"variantId"`
	Quantity          int64  `json:"quantity"`
	LineTotalMinor    int64  `json:"lineTotalMinor"`
	Currency          string `json:"currency"`
	AttributionSource string `json:"attributionSource"`
	AttributionId     string `json:"attributionId"`
	CommissionBps     *int64 `json:"commissionBasisPoints"`
}

type OrderGroupCompleted struct {
	OrderGroupId    string           `json:"orderGroupId"`
	OrderNumber     string           `json:"orderNumber"`
	StoreId         string           `json:"storeId"`
	SellerAccountId string           `json:"sellerAccountId"`
	BuyerAccountId  string           `json:"buyerAccountId"`
	SubtotalMinor   int64            `json:"subtotalMinor"`
	TotalMinor      int64            `json:"totalMinor"`
	RefundedMinor   int64            `json:"refundedMinor"`
	Currency        string           `json:"currency"`
	CompletedAt     *time.Time       `json:"completedAt"`
	AttributedItems []AttributedItem `json:"attributedItems"`
}

type AffiliateSaleReleased struct {
	OrderId      string
	OrderNumber  string
	StoreId      string
	SellerUserId string
	BuyerUserId  string
	Currency     string
	OrderedAt    *time.Time
	Items        []AttributedItem
}

func (completed OrderGroupCompleted) Sale() AffiliateSaleReleased {
	items := make([]AttributedItem, 0, len(completed.AttributedItems))
	for _, item := range completed.AttributedItems {
		if completed.RefundedMinor > 0 && completed.SubtotalMinor > 0 {
			kept := max(completed.SubtotalMinor-completed.RefundedMinor, 0)
			item.LineTotalMinor = item.LineTotalMinor/completed.SubtotalMinor*kept + item.LineTotalMinor%completed.SubtotalMinor*kept/completed.SubtotalMinor
		}
		items = append(items, item)
	}
	return AffiliateSaleReleased{
		OrderId: completed.OrderGroupId, OrderNumber: completed.OrderNumber, StoreId: completed.StoreId, SellerUserId: completed.SellerAccountId,
		BuyerUserId: completed.BuyerAccountId, Currency: completed.Currency, Items: items,
	}
}

type attributedSale struct {
	itemKey, productId, source, sourceId string
	amountMinor                          int64
	lockedBps                            *int64
}

func attributedSales(orderId, currency string, items []AttributedItem) []attributedSale {
	sales := []attributedSale{}
	for index, item := range items {
		validSource := item.AttributionSource == "post" || item.AttributionSource == "clip" || item.AttributionSource == "live"
		sameCurrency := item.Currency == "" || strings.EqualFold(item.Currency, currency)
		if item.ProductId == "" || item.LineTotalMinor <= 0 || item.AttributionId == "" || !validSource || !sameCurrency {
			continue
		}
		key := item.OrderItemId
		if key == "" {
			key = orderId + ":" + item.ProductId + ":" + strconv.Itoa(index)
		}
		sales = append(sales, attributedSale{itemKey: key, productId: item.ProductId, source: item.AttributionSource, sourceId: item.AttributionId, amountMinor: item.LineTotalMinor, lockedBps: item.CommissionBps})
	}
	return sales
}

func (affiliates Affiliates) CreditCommissionsForRelease(ctx context.Context, sale AffiliateSaleReleased) (int, error) {
	sale.Currency = strings.ToUpper(sale.Currency)
	if sale.OrderId == "" || sale.StoreId == "" || sale.SellerUserId == "" || len(sale.Currency) != 3 {
		return 0, nil
	}
	credited := 0
	for _, item := range attributedSales(sale.OrderId, sale.Currency, sale.Items) {
		creatorId, err := affiliates.Container.Directory.ContentOwner(ctx, item.source, item.sourceId)
		if errors.Is(err, repositories.ErrTargetNotFound) {
			continue
		}
		if err != nil {
			return credited, err
		}
		if creatorId == "" || creatorId == sale.BuyerUserId || creatorId == sale.SellerUserId {
			continue
		}
		ok, err := affiliates.creditOne(ctx, sale, item, creatorId)
		if err != nil {
			return credited, err
		}
		if ok {
			credited++
		}
	}
	return credited, nil
}

func (affiliates Affiliates) creditOne(ctx context.Context, sale AffiliateSaleReleased, item attributedSale, creatorId string) (bool, error) {
	credited := false
	err := affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
		if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "affiliate-commission:"+item.itemKey); err != nil {
			return err
		}
		if exists, err := client.AffiliateCommission.Query().Where(affiliatecommission.OrderItemID(item.itemKey)).Exist(ctx); err != nil || exists {
			return err
		}
		if _, approved, err := affiliates.Program.ApprovedCreatorShare(ctx, transaction, creatorId); err != nil || !approved {
			return err
		}
		affiliated, err := client.CreatorAffiliation.Query().Where(creatoraffiliation.CreatorID(creatorId), creatoraffiliation.StoreID(sale.StoreId),
			creatoraffiliation.StatusEQ(creatoraffiliation.StatusActive), creatoraffiliation.ProductIDIn("", item.productId)).Exist(ctx)
		if err != nil || !affiliated {
			return err
		}
		bps, err := affiliates.rateFor(ctx, client, sale.StoreId, item)
		if err != nil {
			return err
		}
		amount := ShareOf(item.amountMinor, bps)
		if amount <= 0 {
			return nil
		}
		now := affiliates.Container.Now().UTC()
		commission, err := client.AffiliateCommission.Create().SetID(uuid.Must(uuid.NewV7())).SetOrderID(sale.OrderId).SetOrderNumber(sale.OrderNumber).SetOrderItemID(item.itemKey).SetProductID(item.productId).
			SetStoreID(sale.StoreId).SetSellerUserID(sale.SellerUserId).SetCreatorID(creatorId).SetAttributionSource(item.source).SetAttributionID(item.sourceId).
			SetSaleMinor(item.amountMinor).SetCommissionBps(bps).SetCommissionMinor(amount).SetCurrency(sale.Currency).SetNillableOrderedAt(sale.OrderedAt).
			SetStatus(affiliatecommission.StatusPending).SetCreatedAt(now).Save(ctx)
		if err != nil {
			return err
		}
		reference := "affiliate-commission:" + item.itemKey
		if _, err := affiliates.settleCommissionInTransaction(ctx, transaction, client, commission); err != nil {
			return err
		}
		if _, err := programservices.RecordEarning(ctx, client, programservices.Earning{
			CreatorId: creatorId, Kind: "affiliate", Reference: reference, SourceType: item.source, SourceId: item.sourceId, Description: "Affiliate commission",
			GrossMinor: item.amountMinor, NetMinor: amount, Unit: sale.Currency, At: now,
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
