package services

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	paymentinterfaces "nantty/modules/payments/src/interfaces"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/creatorsubscription"
	"nantty/platform/regionpricing"
)

const pendingStoreSlotHold = 30 * time.Minute

type StartStorePurchase struct {
	SubscriberId   string
	CreatorId      string
	PlanId         string
	Channel        string
	IdempotencyKey string
}

type StorePurchaseIntentView struct {
	SubscriptionId      string                       `json:"subscriptionId"`
	Platform            string                       `json:"platform"`
	ProductId           string                       `json:"productId"`
	AppAccountToken     string                       `json:"appAccountToken"`
	ObfuscatedAccountId string                       `json:"obfuscatedAccountId"`
	ChannelPrice        MoneyView                    `json:"channelPrice"`
	Subscription        CreatorSubscriptionStateView `json:"subscription"`
}

type StoreReceiptRedemption struct {
	SubscriberId   string
	Channel        string
	ProductId      string
	Receipt        string
	TransactionId  string
	IdempotencyKey string
}

func (service CreatorSubscriptions) StartStorePurchase(ctx context.Context, request StartStorePurchase) (StorePurchaseIntentView, bool, error) {
	store, known := storeByChannel[request.Channel]
	if !known || !service.Container.Payments.StoreBillingConfigured(store) {
		return StorePurchaseIntentView{}, false, ErrStoreBillingOff
	}
	plan, err := service.loadSubscribablePlan(ctx, request.SubscriberId, request.CreatorId, request.PlanId)
	if err != nil {
		return StorePurchaseIntentView{}, false, err
	}
	tier, isTier := regionpricing.FindCreatorTier(plan.AmountMinor, plan.Currency, plan.Interval.String())
	if !isTier {
		return StorePurchaseIntentView{}, false, ErrPlanNotInStore
	}
	subscriptionId, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, service.Container.Resources.Database, service.Container.Idempotency, ledgerutils.IdempotentCommand[string]{
		Scope: "user:" + request.SubscriberId + ":creatorSubscriptions.storeStart", Key: request.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(plan.CreatorID, plan.ID.String(), request.Channel),
		Execute: func(ctx context.Context, transaction *sql.Tx) (string, error) {
			client := service.Container.Client(transaction)
			if err := service.clearWayForNewSubscriptionInTransaction(ctx, client, request.SubscriberId, plan.CreatorID); err != nil {
				return "", err
			}
			slot, err := service.freeStoreSlot(ctx, client, request.SubscriberId, store, tier, plan.Interval.String())
			if err != nil {
				return "", err
			}
			row, err := client.CreatorSubscription.Create().SetID(uuid.Must(uuid.NewV7())).SetSubscriberID(request.SubscriberId).SetCreatorID(plan.CreatorID).
				SetPlanID(plan.ID.String()).SetAmountMinor(plan.AmountMinor).SetCurrency(plan.Currency).SetInterval(creatorsubscription.Interval(plan.Interval.String())).
				SetBillingChannel(creatorsubscription.BillingChannel(store)).SetStoreProductID(regionpricing.CreatorStoreProductId(tier, plan.Interval.String(), slot)).
				SetStoreSlot(slot).SetCreatedAt(service.Container.Now().UTC()).Save(ctx)
			if err != nil {
				return "", err
			}
			return row.ID.String(), nil
		},
	})
	if err != nil {
		return StorePurchaseIntentView{}, false, err
	}
	row, err := service.Container.Client(service.Container.Resources.Database).CreatorSubscription.Get(ctx, uuid.MustParse(subscriptionId))
	if err != nil {
		return StorePurchaseIntentView{}, false, err
	}
	priced := ChannelPriceFor(ConvertCreatorPlan(plan, 0), request.Channel, service.StoreFees(ctx))
	return StorePurchaseIntentView{
		SubscriptionId: subscriptionId, Platform: request.Channel, ProductId: row.StoreProductID, AppAccountToken: subscriptionId, ObfuscatedAccountId: subscriptionId,
		ChannelPrice: priced.ChannelPrice, Subscription: ConvertCreatorSubscription(row),
	}, replayed, nil
}

func (service CreatorSubscriptions) freeStoreSlot(ctx context.Context, client *ent.Client, subscriberId, store, tier, interval string) (int, error) {
	now := service.Container.Now().UTC()
	rows, err := client.CreatorSubscription.Query().Where(creatorsubscription.SubscriberID(subscriberId), creatorsubscription.BillingChannelEQ(creatorsubscription.BillingChannel(store)),
		creatorsubscription.Or(
			creatorsubscription.And(creatorsubscription.StatusIn(accessStatuses()...), creatorsubscription.CurrentPeriodEndGT(now)),
			creatorsubscription.And(creatorsubscription.StatusEQ(creatorsubscription.StatusPending), creatorsubscription.CreatedAtGT(now.Add(-pendingStoreSlotHold))),
		)).All(ctx)
	if err != nil {
		return 0, err
	}
	taken := map[int]bool{}
	for _, row := range rows {
		if product, ok := regionpricing.ParseCreatorStoreProductId(row.StoreProductID); ok && product.Tier == tier && product.Interval == interval {
			taken[product.Slot] = true
		}
	}
	for slot := 1; slot <= regionpricing.CreatorStoreSlots; slot++ {
		if !taken[slot] {
			return slot, nil
		}
	}
	return 0, ErrStoreSlotsFull
}

func (service CreatorSubscriptions) RedeemStoreReceipt(ctx context.Context, request StoreReceiptRedemption) (CreatorSubscriptionStateView, bool, error) {
	store, known := storeByChannel[request.Channel]
	if !known {
		return CreatorSubscriptionStateView{}, false, ErrStoreBillingOff
	}
	if _, isCreatorProduct := regionpricing.ParseCreatorStoreProductId(request.ProductId); !isCreatorProduct {
		return CreatorSubscriptionStateView{}, false, ErrPlanNotInStore
	}
	verified, err := service.Container.Payments.VerifyStoreReceipt(ctx, store, paymentinterfaces.StoreReceipt{ProductId: request.ProductId, ReceiptData: request.Receipt, TransactionId: request.TransactionId})
	if err != nil {
		return CreatorSubscriptionStateView{}, false, err
	}
	if !verified.IsSubscription || verified.ExpiresAt == nil {
		return CreatorSubscriptionStateView{}, false, ErrStoreReceiptMismatch
	}
	view, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, service.Container.Resources.Database, service.Container.Idempotency, ledgerutils.IdempotentCommand[CreatorSubscriptionStateView]{
		Scope: "user:" + request.SubscriberId + ":creatorSubscriptions.storeReceipt", Key: request.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(request.Channel, request.ProductId, request.Receipt, request.TransactionId),
		Execute: func(ctx context.Context, transaction *sql.Tx) (CreatorSubscriptionStateView, error) {
			row, err := service.applyStoreTransactionInTransaction(ctx, transaction, store, verified, request.SubscriberId)
			if err != nil {
				return CreatorSubscriptionStateView{}, err
			}
			return ConvertCreatorSubscription(row), nil
		},
	})
	if err != nil {
		return CreatorSubscriptionStateView{}, false, err
	}
	if err := service.Container.Payments.AcknowledgeStoreSubscription(ctx, store, verified); err != nil {
		service.Container.Resources.Logger.WarnContext(ctx, "store subscription acknowledgement failed; the client acknowledgement or the next notification retries it", "store", store, "error", err.Error())
	}
	return view, replayed, nil
}

func (service CreatorSubscriptions) findStoreSubscription(ctx context.Context, client *ent.Client, store, accountToken, originalTransactionId string) (*ent.CreatorSubscription, error) {
	channel := creatorsubscription.BillingChannel(store)
	if id, err := uuid.Parse(strings.TrimSpace(accountToken)); err == nil {
		row, err := client.CreatorSubscription.Query().Where(creatorsubscription.ID(id), creatorsubscription.BillingChannelEQ(channel)).ForUpdate().Only(ctx)
		if !ent.IsNotFound(err) {
			return row, err
		}
	}
	if originalTransactionId == "" {
		return nil, ErrStoreReceiptUnclaimed
	}
	row, err := client.CreatorSubscription.Query().Where(creatorsubscription.StoreOriginalTransactionID(originalTransactionId), creatorsubscription.BillingChannelEQ(channel)).
		Order(ent.Desc(creatorsubscription.FieldCreatedAt)).ForUpdate().First(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrStoreReceiptUnclaimed
	}
	return row, err
}
