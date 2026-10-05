package services

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	paymentconstants "zudomart/modules/payments/src/constants"
	paymentinterfaces "zudomart/modules/payments/src/interfaces"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/platform/httpserver"
)

var ErrStoreProductUnknown = httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_PRODUCT_NOT_A_SUBSCRIPTION", "This product is not a subscription.")

type StoreReceiptRequest struct {
	UserId        string
	Platform      string
	ProfileId     string
	ProductId     string
	Receipt       string
	TransactionId string
}

func (billing Billing) RedeemStoreSubscription(ctx context.Context, request StoreReceiptRequest) (SubscriptionView, error) {
	planCode, interval, known := billing.PlanForStoreProduct(ctx, request.ProductId)
	product := struct{ PlanCode, Interval string }{planCode, interval}
	if !known || !constants.Plans[product.PlanCode].InAppAllowed {
		return SubscriptionView{}, ErrStoreProductUnknown
	}
	profile, found, err := billing.Container.Identity.FindProfile(ctx, request.ProfileId)
	if err != nil {
		return SubscriptionView{}, err
	}
	if !found || profile.OwnerUserId != request.UserId || !PlanAllowedForProfile(product.PlanCode, profile.ProfileType) {
		return SubscriptionView{}, ErrProfileNotEligible
	}
	store := map[string]string{"ios": paymentconstants.StoreAppleIap, "android": paymentconstants.StoreGooglePlay}[request.Platform]
	verified, err := billing.Container.Payments.VerifyStoreReceipt(ctx, store, paymentinterfaces.StoreReceipt{ProductId: request.ProductId, ReceiptData: request.Receipt, TransactionId: request.TransactionId})
	if err != nil {
		return SubscriptionView{}, err
	}
	if !verified.IsSubscription || verified.ExpiresAt == nil || !verified.ExpiresAt.After(billing.Container.Now()) {
		return SubscriptionView{}, ErrStoreProductUnknown
	}
	channel := map[string]subscription.Channel{paymentconstants.StoreAppleIap: subscription.ChannelAppleIap, paymentconstants.StoreGooglePlay: subscription.ChannelGooglePlay}[store]
	var view SubscriptionView
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := billing.Container.Client(transaction)
		row, err := client.Subscription.Query().Where(subscription.StoreOriginalTransactionID(verified.OriginalTransactionId), subscription.ChannelEQ(channel)).ForUpdate().First(ctx)
		if ent.IsNotFound(err) {
			row, err = client.Subscription.Create().SetID(uuid.Must(uuid.NewV7())).SetProfileID(profile.ProfileId).SetProfileType(profile.ProfileType).SetOwnerUserID(request.UserId).
				SetPlanCode(product.PlanCode).SetInterval(subscription.Interval(product.Interval)).SetChannel(channel).SetStatus(subscription.StatusActive).
				SetListAmountMinor(verified.PriceMinor).SetAmountMinor(verified.PriceMinor).SetCurrency(verified.Currency).SetStoreOriginalTransactionID(verified.OriginalTransactionId).
				SetCurrentPeriodEndsAt(*verified.ExpiresAt).SetCreatedAt(billing.Container.Now()).Save(ctx)
			if err != nil {
				return err
			}
			if err := billing.emit(ctx, transaction, "entitlement.granted", row.ProfileID, entitlementData(row, "active")); err != nil {
				return err
			}
		} else if err != nil {
			return err
		} else if row, err = row.Update().SetStatus(subscription.StatusActive).SetCurrentPeriodEndsAt(*verified.ExpiresAt).Save(ctx); err != nil {
			return err
		}
		if _, err := billing.Container.Payments.RecordVerifiedStorePurchaseInTransaction(ctx, transaction, store, request.UserId, paymentconstants.PurposeSubscription, row.ID.String(), verified); err != nil {
			return err
		}
		view = ConvertSubscription(row)
		return nil
	})
	return view, err
}

func (billing Billing) HandleStoreSubscriptionNotice(ctx context.Context, transaction *sql.Tx, notice paymentmodels.StoreSubscriptionNotice) error {
	client := billing.Container.Client(transaction)
	row, err := client.Subscription.Query().Where(subscription.StoreOriginalTransactionID(notice.OriginalTransactionId)).ForUpdate().First(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	switch notice.Kind {
	case string(paymentinterfaces.StoreNotificationRenewed):
		if notice.ExpiresAt == nil {
			return nil
		}
		return row.Update().SetStatus(subscription.StatusActive).SetCurrentPeriodEndsAt(*notice.ExpiresAt).Exec(ctx)
	case string(paymentinterfaces.StoreNotificationRenewalFailed):
		return row.Update().SetStatus(subscription.StatusPastDue).Exec(ctx)
	case string(paymentinterfaces.StoreNotificationGrace):
		update := row.Update().SetStatus(subscription.StatusGrace)
		if notice.ExpiresAt != nil {
			update.SetGraceEndsAt(*notice.ExpiresAt)
		}
		if row, err = update.Save(ctx); err != nil {
			return err
		}
		return billing.emit(ctx, transaction, "entitlement.graceStarted", row.ProfileID, entitlementData(row, string(row.Status)))
	case string(paymentinterfaces.StoreNotificationExpired):
		return billing.revokeInTransaction(ctx, transaction, row, subscription.StatusDowngraded)
	}
	return nil
}

func (billing Billing) HandleStorePurchaseRefunded(ctx context.Context, transaction *sql.Tx, purchase paymentmodels.RefundedStorePurchase) error {
	id, err := uuid.Parse(purchase.SubjectId)
	if err != nil {
		return nil
	}
	row, err := billing.Container.Client(transaction).Subscription.Query().Where(subscription.ID(id)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return billing.revokeInTransaction(ctx, transaction, row, subscription.StatusCanceled)
}

func (billing Billing) revokeInTransaction(ctx context.Context, transaction *sql.Tx, row *ent.Subscription, status subscription.Status) error {
	if row.Status == status {
		return nil
	}
	if err := row.Update().SetStatus(status).Exec(ctx); err != nil {
		return err
	}
	return billing.emit(ctx, transaction, "entitlement.revoked", row.ProfileID, entitlementData(row, string(status)))
}
