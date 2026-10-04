package services

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	paymentconstants "zudomart/modules/payments/src/constants"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
)

type VerificationRefundPath string

const (
	RefundPathCard           VerificationRefundPath = "card_refund"
	RefundPathNothingCharged VerificationRefundPath = "nothing_charged"
	RefundPathGooglePlay     VerificationRefundPath = "google_play_revoke"
	RefundPathAppleManual    VerificationRefundPath = "apple_manual"
	RefundPathAlreadyDone    VerificationRefundPath = "already_done"

	verificationRefundPending = "verificationRefund:pending"
	verificationRefundDone    = "verificationRefund:done"
)

type VerificationRefundRequest struct {
	CaseId         string `json:"caseId"`
	SubscriptionId string `json:"subscriptionId"`
	AccountId      string `json:"accountId"`
	Reason         string `json:"reason"`
}

// DecideVerificationRefundPath picks how a rejected verification is refunded. A trial that has not converted was
// never charged (its card check was already refunded), Google Play can be revoked with a full refund, and Apple
// gives developers no refund API, so those purchases are flagged for a manual store refund.
func DecideVerificationRefundPath(row *ent.Subscription, now time.Time) VerificationRefundPath {
	switch {
	case row.LastError == verificationRefundDone:
		return RefundPathAlreadyDone
	case row.Channel == subscription.ChannelGooglePlay:
		return RefundPathGooglePlay
	case row.Channel == subscription.ChannelAppleIap:
		return RefundPathAppleManual
	case row.Channel != subscription.ChannelWebPaystack || row.BillingReference == "" || row.AmountMinor == 0:
		return RefundPathNothingCharged
	case row.WithTrial && (row.TrialEndsAt == nil || now.Before(*row.TrialEndsAt)):
		return RefundPathNothingCharged
	}
	return RefundPathCard
}

func (billing Billing) HandleVerificationRefundRequested(ctx context.Context, request VerificationRefundRequest) error {
	subscriptionId, err := uuid.Parse(request.SubscriptionId)
	if err != nil {
		return nil
	}
	var row *ent.Subscription
	path := RefundPathAlreadyDone
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		row, err = billing.Container.Client(transaction).Subscription.Query().Where(subscription.ID(subscriptionId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		if path = DecideVerificationRefundPath(row, billing.Container.Now()); path == RefundPathAlreadyDone || row.LastError == verificationRefundPending {
			return nil
		}
		if err := row.Update().SetStatus(subscription.StatusCanceled).SetCancelAtPeriodEnd(true).SetLastError(verificationRefundPending).Exec(ctx); err != nil {
			return err
		}
		return billing.emit(ctx, transaction, "entitlement.revoked", row.ProfileID, entitlementData(row, string(subscription.StatusCanceled)))
	})
	if err != nil || row == nil || path == RefundPathAlreadyDone {
		return err
	}
	outcome, err := billing.executeVerificationRefund(ctx, row, path, request.Reason)
	if err != nil {
		return err
	}
	return databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if err := billing.Container.Client(transaction).Subscription.UpdateOneID(row.ID).SetLastError(verificationRefundDone).Exec(ctx); err != nil {
			return err
		}
		return billing.emit(ctx, transaction, "verificationRefund."+outcome, row.ID.String(), map[string]any{
			"caseId": request.CaseId, "subscriptionId": row.ID.String(), "accountId": row.OwnerUserID, "channel": row.Channel.String(), "amount": money(row.AmountMinor, row.Currency), "path": string(path),
		})
	})
}

func (billing Billing) executeVerificationRefund(ctx context.Context, row *ent.Subscription, path VerificationRefundPath, reason string) (string, error) {
	payments := billing.Container.Payments
	switch path {
	case RefundPathCard:
		if _, err := payments.RefundBillingSubscriptionCharge(ctx, row.BillingReference, "Checkmark verification rejected: "+reason); err != nil {
			if paymentservices.IsDefinitiveProviderRejection(err) {
				billing.Container.Resources.Logger.ErrorContext(ctx, "ALERT verification refund rejected by the provider; refund it by hand", "subscriptionId", row.ID.String(), "error", err.Error())
				return "failed", nil
			}
			return "", err
		}
		return "succeeded", nil
	case RefundPathGooglePlay:
		err := payments.RevokeStoreSubscriptionWithRefund(ctx, paymentconstants.StoreGooglePlay, row.StoreOriginalTransactionID)
		if errors.Is(err, paymentservices.ErrStoreRefundNotSupported) {
			return "manualStoreRefundRequired", nil
		}
		if err != nil {
			return "", err
		}
		return "succeeded", nil
	case RefundPathAppleManual:
		billing.Container.Resources.Logger.WarnContext(ctx, "verification rejected on an App Store purchase; the person must request the refund from Apple", "subscriptionId", row.ID.String())
		return "manualStoreRefundRequired", nil
	}
	if row.Channel == subscription.ChannelWebPaystack && row.BillingReference != "" {
		if err := payments.CancelBillingSubscription(ctx, row.BillingReference); err != nil && !errors.Is(err, paymentservices.ErrPaymentNotFound) {
			return "", err
		}
	}
	return "notCharged", nil
}
