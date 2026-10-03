package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/storepurchase"
	"zudomart/modules/payments/src/generated/ent/webhookevent"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

func (gateway *PaymentGateway) VerifyStoreReceipt(ctx context.Context, store string, receipt interfaces.StoreReceipt) (interfaces.VerifiedStorePurchase, error) {
	verifier, err := gateway.Container.StoreVerifier(store)
	if err != nil {
		return interfaces.VerifiedStorePurchase{}, err
	}
	verified, err := verifier.VerifyPurchaseReceipt(ctx, receipt)
	switch {
	case errors.Is(err, interfaces.ErrStoreVerificationNotConfigured):
		return verified, ErrStoreNotConfigured
	case errors.Is(err, interfaces.ErrStoreReceiptInvalid):
		return verified, ErrStoreReceiptInvalid
	case err != nil:
		return verified, convertProviderError(err)
	case verified.StoreTransactionId == "" || verified.ProductId != receipt.ProductId:
		return verified, ErrStoreReceiptInvalid
	}
	return verified, nil
}

type RecordedStorePurchase struct {
	models.VerifiedStorePurchaseRecord
	SubjectId string
}

func (gateway *PaymentGateway) RecordVerifiedStorePurchaseInTransaction(ctx context.Context, transaction *sql.Tx, store, userId, purpose, subjectId string, verified interfaces.VerifiedStorePurchase) (RecordedStorePurchase, error) {
	verifier, err := gateway.Container.StoreVerifier(store)
	if err != nil {
		return RecordedStorePurchase{}, err
	}
	client := gateway.Container.Client(transaction)
	existing, err := client.StorePurchase.Query().Where(storepurchase.StoreEQ(storepurchase.Store(store)), storepurchase.StoreTransactionID(verified.StoreTransactionId)).Only(ctx)
	if err == nil {
		if existing.UserID != userId {
			return RecordedStorePurchase{}, ErrStoreReceiptRedeemedByOther
		}
		record := convertStorePurchaseRecord(existing)
		record.Replayed = true
		return record, nil
	}
	if !ent.IsNotFound(err) {
		return RecordedStorePurchase{}, err
	}
	fee := StoreFeeRoundedUp(verified.PriceMinor, verifier.StoreFeeBasisPoints())
	created, err := client.StorePurchase.Create().
		SetStore(storepurchase.Store(store)).SetStoreTransactionID(verified.StoreTransactionId).SetOriginalTransactionID(verified.OriginalTransactionId).
		SetProductID(verified.ProductId).SetUserID(userId).SetPurpose(purpose).SetSubjectID(subjectId).
		SetPriceMinor(verified.PriceMinor).SetCurrency(verified.Currency).SetStoreFeeMinor(fee).SetEnvironment(verified.Environment).
		SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return RecordedStorePurchase{}, err
	}
	return convertStorePurchaseRecord(created), nil
}

func StoreFeeRoundedUp(priceMinor, basisPoints int64) int64 {
	if priceMinor <= 0 || basisPoints <= 0 {
		return 0
	}
	return (priceMinor*basisPoints + 9_999) / 10_000
}

func convertStorePurchaseRecord(purchase *ent.StorePurchase) RecordedStorePurchase {
	return RecordedStorePurchase{SubjectId: purchase.SubjectID, VerifiedStorePurchaseRecord: models.VerifiedStorePurchaseRecord{
		Store: string(purchase.Store), StoreTransactionId: purchase.StoreTransactionID, OriginalTransactionId: purchase.OriginalTransactionID,
		ProductId: purchase.ProductID, PriceMinor: purchase.PriceMinor, Currency: purchase.Currency, StoreFeeMinor: purchase.StoreFeeMinor, Environment: purchase.Environment,
	}}
}

func (gateway *PaymentGateway) HandleSignedStoreRefundNotification(ctx context.Context, store string, rawBody []byte, headers http.Header) error {
	verifier, err := gateway.Container.StoreVerifier(store)
	if err != nil {
		return err
	}
	notification, err := verifier.VerifySignedRefundNotification(ctx, rawBody, headers)
	if errors.Is(err, interfaces.ErrStoreVerificationNotConfigured) {
		return ErrStoreNotConfigured
	}
	if err != nil {
		return ErrInvalidWebhookSignature
	}
	if !notification.IsRefund() {
		return gateway.ApplyVerifiedStoreSubscriptionNotice(ctx, store, notification)
	}
	return gateway.ApplyVerifiedStoreRefund(ctx, store, notification)
}

func (gateway *PaymentGateway) ApplyVerifiedStoreSubscriptionNotice(ctx context.Context, store string, notification interfaces.StoreRefundNotification) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		eventKey := string(notification.Kind) + ":" + notification.NotificationId
		claimed, err := gateway.claimWebhookEventInTransaction(ctx, client, store, eventKey, string(notification.Kind), notification.OriginalTransactionId, nil, nil)
		if err != nil || !claimed {
			return err
		}
		now := gateway.Container.Now().UTC()
		if err := client.WebhookEvent.Update().Where(webhookevent.Provider(store), webhookevent.EventKey(truncate(eventKey, 255))).SetProcessedAt(now).AddAttemptCount(1).Exec(ctx); err != nil {
			return err
		}
		return gateway.notifyStoreSubscriptionHandlers(ctx, transaction, models.StoreSubscriptionNotice{
			Store: store, Kind: string(notification.Kind), StoreTransactionId: notification.StoreTransactionId, OriginalTransactionId: notification.OriginalTransactionId,
			ProductId: notification.ProductId, ExpiresAt: notification.ExpiresAt, OccurredAt: now,
		})
	})
}

func (gateway *PaymentGateway) ApplyVerifiedStoreRefund(ctx context.Context, store string, notification interfaces.StoreRefundNotification) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		claimed, err := gateway.claimWebhookEventInTransaction(ctx, client, store, "refund:"+notification.NotificationId, "refund", notification.StoreTransactionId, nil, nil)
		if err != nil || !claimed {
			return err
		}
		if err := client.WebhookEvent.Update().Where(webhookevent.Provider(store), webhookevent.EventKey(truncate("refund:"+notification.NotificationId, 255))).
			SetProcessedAt(gateway.Container.Now().UTC()).AddAttemptCount(1).Exec(ctx); err != nil {
			return err
		}
		purchase, err := client.StorePurchase.Query().Where(storepurchase.StoreEQ(storepurchase.Store(store)), storepurchase.StoreTransactionID(notification.StoreTransactionId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) && notification.OriginalTransactionId != "" {
			purchase, err = client.StorePurchase.Query().Where(storepurchase.StoreEQ(storepurchase.Store(store)), storepurchase.OriginalTransactionID(notification.OriginalTransactionId)).
				Order(ent.Desc(storepurchase.FieldCreatedAt)).ForUpdate().First(ctx)
		}
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil || purchase.Status == storepurchase.StatusRefunded {
			return err
		}
		refundedAt := notification.RefundedAt
		if refundedAt.IsZero() {
			refundedAt = gateway.Container.Now().UTC()
		}
		if err := purchase.Update().SetStatus(storepurchase.StatusRefunded).SetRefundedAt(refundedAt).Exec(ctx); err != nil {
			return err
		}
		handler, err := gateway.storeRefundHandler(purchase.Purpose)
		if err != nil {
			return err
		}
		if err := handler.HandleStorePurchaseRefunded(ctx, transaction, models.RefundedStorePurchase{
			Store: store, StoreTransactionId: purchase.StoreTransactionID, UserId: purchase.UserID, Purpose: purchase.Purpose,
			SubjectId: purchase.SubjectID, PriceMinor: purchase.PriceMinor, Currency: purchase.Currency, RefundedAt: refundedAt,
		}); err != nil {
			return err
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "storePurchase.refunded", purchase.ID.String(), refundedAt, map[string]any{
			"store": store, "storeTransactionId": purchase.StoreTransactionID, "userId": purchase.UserID, "purpose": purchase.Purpose, "subjectId": purchase.SubjectID,
		})
	})
}
