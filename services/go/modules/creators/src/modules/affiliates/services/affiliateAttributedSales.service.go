package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/affiliateattributedsale"
	"nantty/modules/creators/src/generated/ent/affiliatecommission"
	"nantty/modules/creators/src/generated/ent/affiliateordervoid"
	"nantty/modules/creators/src/generated/ent/creatoraffiliation"
	"nantty/modules/creators/src/repositories"
)

type saleLabels struct {
	storeName, productName, creatorHandle string
}

func (affiliates Affiliates) forEachAttributedCreator(ctx context.Context, sale *AffiliateSaleReleased, work func(item attributedSale, creatorId string, labels saleLabels) error) error {
	sale.Currency = strings.ToUpper(sale.Currency)
	if sale.OrderId == "" || sale.StoreId == "" || sale.SellerUserId == "" || len(sale.Currency) != 3 {
		return nil
	}
	for _, item := range attributedSales(sale.OrderId, sale.Currency, sale.Items) {
		creatorId, err := affiliates.attributedCreator(ctx, item)
		if err != nil {
			return err
		}
		if creatorId == "" || creatorId == sale.BuyerUserId || creatorId == sale.SellerUserId {
			continue
		}
		labels, err := affiliates.labelsFor(ctx, sale.StoreId, item.productId, creatorId)
		if err != nil {
			return err
		}
		if err := work(item, creatorId, labels); err != nil {
			return err
		}
	}
	return nil
}

func (affiliates Affiliates) attributedCreator(ctx context.Context, item attributedSale) (string, error) {
	if item.source == "link" {
		id, err := uuid.Parse(item.sourceId)
		if err != nil {
			return "", nil
		}
		link, err := affiliates.Container.Client(affiliates.Container.Resources.Database).AffiliateLink.Get(ctx, id)
		if ent.IsNotFound(err) || (err == nil && link.ProductID != item.productId) {
			return "", nil
		}
		if err != nil {
			return "", err
		}
		return link.CreatorID, nil
	}
	creatorId, err := affiliates.Container.Directory.ContentOwner(ctx, item.source, item.sourceId)
	if errors.Is(err, repositories.ErrTargetNotFound) {
		return "", nil
	}
	return creatorId, err
}

func (affiliates Affiliates) labelsFor(ctx context.Context, storeId, productId, creatorId string) (saleLabels, error) {
	directory := affiliates.Container.Directory
	stores, err := directory.FindStores(ctx, []string{storeId})
	if err != nil {
		return saleLabels{}, err
	}
	products, err := directory.FindProducts(ctx, []string{productId})
	if err != nil {
		return saleLabels{}, err
	}
	users, err := directory.FindUserSummaries(ctx, []string{creatorId})
	return saleLabels{storeName: stores[storeId].Name, productName: products[productId].Name, creatorHandle: users[creatorId].Username}, err
}

func lockAffiliateOrder(ctx context.Context, transaction *sql.Tx, orderId string) error {
	_, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "affiliate-order:"+orderId)
	return err
}

func lockAttributedItem(ctx context.Context, transaction *sql.Tx, item attributedSale) error {
	_, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "affiliate-commission:"+item.itemKey)
	return err
}

// eligibleRate decides whether the creator may earn on this line: an approved creator, an active affiliation covering the product,
// and a purchase inside the store's attribution window. The rate is the one locked at checkout when there is one.
func (affiliates Affiliates) eligibleRate(ctx context.Context, transaction *sql.Tx, client *ent.Client, sale AffiliateSaleReleased, item attributedSale, creatorId string) (int64, bool, error) {
	if _, approved, err := affiliates.Program.ApprovedCreatorShare(ctx, transaction, creatorId); err != nil || !approved {
		return 0, false, err
	}
	affiliated, err := client.CreatorAffiliation.Query().Where(creatoraffiliation.CreatorID(creatorId), creatoraffiliation.StoreID(sale.StoreId),
		creatoraffiliation.StatusEQ(creatoraffiliation.StatusActive), creatoraffiliation.ProductIDIn("", item.productId)).Exist(ctx)
	if err != nil || !affiliated {
		return 0, false, err
	}
	settings, err := affiliates.settingsRow(ctx, client, sale.StoreId)
	if err != nil {
		return 0, false, err
	}
	if !withinAttributionWindow(item.attributedAt, sale.OrderedAt, convertSettings(settings).CookieWindowDays, affiliates.Container.Now()) {
		return 0, false, nil
	}
	bps, err := affiliates.rateFor(ctx, client, sale.StoreId, item)
	return bps, err == nil, err
}

func (affiliates Affiliates) RecordAwaitingAttributedSales(ctx context.Context, sale AffiliateSaleReleased) (int, error) {
	recorded := 0
	err := affiliates.forEachAttributedCreator(ctx, &sale, func(item attributedSale, creatorId string, labels saleLabels) error {
		return affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
			if err := lockAffiliateOrder(ctx, transaction, sale.OrderId); err != nil {
				return err
			}
			if err := lockAttributedItem(ctx, transaction, item); err != nil {
				return err
			}
			if voided, err := client.AffiliateOrderVoid.Query().Where(affiliateordervoid.ID(sale.OrderId)).Exist(ctx); err != nil || voided {
				return err
			}
			if seen, err := client.AffiliateAttributedSale.Query().Where(affiliateattributedsale.OrderItemID(item.itemKey)).Exist(ctx); err != nil || seen {
				return err
			}
			if credited, err := client.AffiliateCommission.Query().Where(affiliatecommission.OrderItemID(item.itemKey)).Exist(ctx); err != nil || credited {
				return err
			}
			bps, eligible, err := affiliates.eligibleRate(ctx, transaction, client, sale, item, creatorId)
			if err != nil || !eligible || ShareOf(item.amountMinor, bps) <= 0 {
				return err
			}
			recorded++
			return attributedSaleRow(client, sale, item, creatorId, labels, bps, ShareOf(item.amountMinor, bps), affiliates.Container.Now().UTC()).Exec(ctx)
		})
	})
	return recorded, err
}

// VoidAwaitingAttributedSales also remembers the order as voided, so a paid event that is processed after the cancellation
// or refund never leaves a pending sale behind.
func (affiliates Affiliates) VoidAwaitingAttributedSales(ctx context.Context, orderId, reason string) (int, error) {
	now := affiliates.Container.Now().UTC()
	voided := 0
	err := affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
		if err := lockAffiliateOrder(ctx, transaction, orderId); err != nil {
			return err
		}
		err := client.AffiliateOrderVoid.Create().SetID(orderId).SetReason(reason).SetCreatedAt(now).OnConflictColumns(affiliateordervoid.FieldID).DoNothing().Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		voided, err = client.AffiliateAttributedSale.Update().Where(affiliateattributedsale.OrderID(orderId), affiliateattributedsale.StatusEQ(affiliateattributedsale.StatusAwaiting)).
			SetStatus(affiliateattributedsale.StatusVoided).SetVoidReason(reason).SetDecidedAt(now).Save(ctx)
		return err
	})
	return voided, err
}

func attributedSaleRow(client *ent.Client, sale AffiliateSaleReleased, item attributedSale, creatorId string, labels saleLabels, bps, amount int64, now time.Time) *ent.AffiliateAttributedSaleCreate {
	return client.AffiliateAttributedSale.Create().SetOrderID(sale.OrderId).SetOrderNumber(sale.OrderNumber).SetOrderItemID(item.itemKey).SetProductID(item.productId).
		SetProductName(truncateLabel(labels.productName, 200)).SetStoreID(sale.StoreId).SetStoreName(truncateLabel(labels.storeName, 200)).SetSellerUserID(sale.SellerUserId).
		SetCreatorID(creatorId).SetAttributionSource(item.source).SetAttributionID(item.sourceId).SetSaleMinor(item.amountMinor).SetCommissionBps(bps).
		SetEstimatedCommissionMinor(amount).SetCurrency(sale.Currency).SetNillableOrderedAt(sale.OrderedAt).SetCreatedAt(now).SetUpdatedAt(now)
}

func completeAttributedSale(ctx context.Context, client *ent.Client, sale AffiliateSaleReleased, item attributedSale, creatorId string, labels saleLabels, bps, amount int64, now time.Time) error {
	updated, err := client.AffiliateAttributedSale.Update().Where(affiliateattributedsale.OrderItemID(item.itemKey)).
		SetStatus(affiliateattributedsale.StatusCompleted).SetVoidReason("").SetDecidedAt(now).Save(ctx)
	if err != nil || updated > 0 {
		return err
	}
	return attributedSaleRow(client, sale, item, creatorId, labels, bps, amount, now).SetStatus(affiliateattributedsale.StatusCompleted).SetDecidedAt(now).Exec(ctx)
}

func voidAttributedSale(ctx context.Context, client *ent.Client, itemKey, reason string, now time.Time) error {
	return client.AffiliateAttributedSale.Update().Where(affiliateattributedsale.OrderItemID(itemKey), affiliateattributedsale.StatusEQ(affiliateattributedsale.StatusAwaiting)).
		SetStatus(affiliateattributedsale.StatusVoided).SetVoidReason(reason).SetDecidedAt(now).Exec(ctx)
}

func truncateLabel(value string, maximum int) string {
	if len(value) <= maximum {
		return value
	}
	return strings.ToValidUTF8(value[:maximum], "")
}
