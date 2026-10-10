package services

import (
	"context"
	"database/sql"
	"errors"

	paymentinterfaces "zudomart/modules/payments/src/interfaces"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/creatorsubscription"
	"zudomart/modules/subscriptions/src/models"
	"zudomart/platform/regionpricing"
)

func (service CreatorSubscriptions) HandleStoreSubscriptionNotice(ctx context.Context, transaction *sql.Tx, notice paymentmodels.StoreSubscriptionNotice) error {
	if _, isCreatorProduct := regionpricing.ParseCreatorStoreProductId(notice.ProductId); !isCreatorProduct {
		return nil
	}
	if notice.Kind == string(paymentinterfaces.StoreNotificationRenewed) {
		if notice.Transaction == nil || notice.Transaction.ExpiresAt == nil {
			return nil
		}
		_, err := service.applyStoreTransactionInTransaction(ctx, transaction, notice.Store, *notice.Transaction, "")
		if errors.Is(err, ErrStoreReceiptUnclaimed) || errors.Is(err, ErrStoreReceiptMismatch) {
			service.Container.Resources.Logger.WarnContext(ctx, "store renewal does not match a creator subscription", "store", notice.Store, "productId", notice.ProductId, "error", err.Error())
			return nil
		}
		return err
	}
	row, err := service.findStoreSubscription(ctx, service.Container.Client(transaction), notice.Store, notice.AccountToken, notice.OriginalTransactionId)
	if errors.Is(err, ErrStoreReceiptUnclaimed) {
		return nil
	}
	if err != nil {
		return err
	}
	return service.applyStoreStateInTransaction(ctx, transaction, row, notice)
}

func (service CreatorSubscriptions) applyStoreStateInTransaction(ctx context.Context, transaction *sql.Tx, row *ent.CreatorSubscription, notice paymentmodels.StoreSubscriptionNotice) error {
	now := service.Container.Now().UTC()
	live := row.Status == creatorsubscription.StatusActive || row.Status == creatorsubscription.StatusPastDue
	var next creatorsubscription.Status
	eventType := ""
	update := row.Update()
	switch paymentinterfaces.StoreNotificationKind(notice.Kind) {
	case paymentinterfaces.StoreNotificationRenewalFailed:
		if row.Status != creatorsubscription.StatusActive {
			return nil
		}
		next, eventType = creatorsubscription.StatusPastDue, "creatorSubscription.pastDue"
		update.SetLastError("storeBillingRetry")
	case paymentinterfaces.StoreNotificationGrace:
		if !live {
			return nil
		}
		next, eventType = creatorsubscription.StatusPastDue, "creatorSubscription.pastDue"
		graceEnd := now.Add(models.CreatorRenewalGracePeriod)
		if row.CurrentPeriodEnd == nil || row.CurrentPeriodEnd.Before(graceEnd) {
			update.SetCurrentPeriodEnd(graceEnd)
		}
		update.SetLastError("storeGracePeriod")
	case paymentinterfaces.StoreNotificationCancelled:
		if !live {
			return nil
		}
		next, eventType = creatorsubscription.StatusCancelled, "creatorSubscription.cancelled"
	case paymentinterfaces.StoreNotificationResumed:
		if row.Status != creatorsubscription.StatusCancelled || !models.HasCreatorSubscriberAccess(row.Status.String(), row.CurrentPeriodEnd, now) {
			return nil
		}
		next, eventType = creatorsubscription.StatusActive, "creatorSubscription.resumed"
	case paymentinterfaces.StoreNotificationExpired:
		if row.Status == creatorsubscription.StatusExpired || row.Status == creatorsubscription.StatusFailed {
			return nil
		}
		next, eventType = creatorsubscription.StatusExpired, "creatorSubscription.expired"
		if row.Status == creatorsubscription.StatusPending {
			next, eventType = creatorsubscription.StatusFailed, ""
		}
	default:
		return nil
	}
	changed, err := update.SetStatus(next).ClearNextChargeAt().Save(ctx)
	if err != nil || eventType == "" {
		return err
	}
	data := lifecycleEventData(changed)
	data["billingChannel"], data["reason"] = changed.BillingChannel.String(), "store_"+notice.Kind
	return service.emit(ctx, transaction, eventType, changed.ID.String(), data)
}
