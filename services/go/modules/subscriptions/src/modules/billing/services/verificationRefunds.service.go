package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	paymentconstants "zudomart/modules/payments/src/constants"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
)

type VerificationRefundPath string

const (
	RefundPathCard           VerificationRefundPath = "card_refund"
	RefundPathNothingCharged VerificationRefundPath = "nothing_charged"
	RefundPathGooglePlay     VerificationRefundPath = "google_play_revoke"
	RefundPathAppleManual    VerificationRefundPath = "apple_manual"
	RefundPathCardShare      VerificationRefundPath = "card_share_refund"
	RefundPathGoogleShare    VerificationRefundPath = "google_play_share_refund"
	RefundPathAlreadyDone    VerificationRefundPath = "already_done"

	verificationRefundPending = "verificationRefund:pending"
	verificationRefundDone    = "verificationRefund:done"
)

type VerificationRefundRequest struct {
	CaseId         string `json:"caseId"`
	SubscriptionId string `json:"subscriptionId"`
	AccountId      string `json:"accountId"`
	ProfileId      string `json:"profileId"`
	Reason         string `json:"reason"`
}

func DecideVerificationRefundPath(row *ent.Subscription, now time.Time) VerificationRefundPath {
	keeps := KeepsPlanOnRejection(row.PlanCode)
	switch {
	case row.LastError == verificationRefundDone:
		return RefundPathAlreadyDone
	case row.Channel == subscription.ChannelGooglePlay && keeps:
		return RefundPathGoogleShare
	case row.Channel == subscription.ChannelGooglePlay:
		return RefundPathGooglePlay
	case row.Channel == subscription.ChannelAppleIap:
		return RefundPathAppleManual
	case !IsWebCheckoutChannel(row.Channel) || row.BillingReference == "" || row.AmountMinor == 0:
		return RefundPathNothingCharged
	case row.WithTrial && (row.TrialEndsAt == nil || now.Before(*row.TrialEndsAt)):
		return RefundPathNothingCharged
	case keeps:
		return RefundPathCardShare
	}
	return RefundPathCard
}

func (billing Billing) HandleVerificationRefundRequested(ctx context.Context, request VerificationRefundRequest) error {
	subscriptionId, err := uuid.Parse(request.SubscriptionId)
	if err != nil {
		return nil
	}
	if combined, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.ID(subscriptionId), subscription.PlanCode(constants.PlanGoldCombined)).Only(ctx); err == nil {
		return billing.handleCombinedGoldVerificationRefund(ctx, combined, request)
	} else if !ent.IsNotFound(err) {
		return err
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
		if KeepsPlanOnRejection(row.PlanCode) {
			return row.Update().SetLastError(verificationRefundPending).Exec(ctx)
		}
		if err := row.Update().SetStatus(subscription.StatusCanceled).SetCancelAtPeriodEnd(true).SetLastError(verificationRefundPending).Exec(ctx); err != nil {
			return err
		}
		return billing.emit(ctx, transaction, "entitlement.revoked", row.ProfileID, entitlementData(row, string(subscription.StatusCanceled)))
	})
	if err != nil || row == nil || path == RefundPathAlreadyDone {
		return err
	}
	share := int64(0)
	if KeepsPlanOnRejection(row.PlanCode) {
		share = billing.checkmarkShareFor(ctx, row)
		path = ApplyShareToPath(path, share)
	}
	outcome, err := billing.executeVerificationRefund(ctx, row, path, share, request)
	if err != nil {
		return err
	}
	return databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		locked, err := billing.Container.Client(transaction).Subscription.Query().Where(subscription.ID(row.ID)).ForUpdate().Only(ctx)
		if err != nil || locked.LastError == verificationRefundDone {
			return err
		}
		if err := locked.Update().SetLastError(verificationRefundDone).Exec(ctx); err != nil {
			return err
		}
		data := map[string]any{
			"caseId": request.CaseId, "subscriptionId": row.ID.String(), "accountId": row.OwnerUserID, "channel": row.Channel.String(), "amount": money(row.AmountMinor, row.Currency), "path": string(path),
			"refundScope": "full",
		}
		if KeepsPlanOnRejection(row.PlanCode) {
			data["refundScope"] = "checkmark_share"
			if share > 0 {
				data["refundAmount"] = money(share, row.Currency)
			}
		}
		return billing.emit(ctx, transaction, "verificationRefund."+outcome, row.ID.String(), data)
	})
}

func (billing Billing) executeVerificationRefund(ctx context.Context, row *ent.Subscription, path VerificationRefundPath, share int64, request VerificationRefundRequest) (string, error) {
	payments := billing.Container.Payments
	reason := request.Reason
	switch path {
	case RefundPathCardShare:
		return billing.refundCheckmarkShareToCard(ctx, row, share, request)
	case RefundPathGoogleShare:
		err := payments.RefundStoreSubscriptionPartially(ctx, paymentconstants.StoreGooglePlay, row.StoreOriginalTransactionID, share, row.Currency)
		if errors.Is(err, paymentservices.ErrStoreRefundNotSupported) {
			return "manualStoreRefundRequired", nil
		}
		if err != nil {
			return "", err
		}
		return "succeeded", nil
	case RefundPathCard:
		if strings.HasPrefix(row.BillingReference, "ren-") {
			return payments.RefundSubscriptionPayment(ctx, paymentservices.SubscriptionPaymentRefund{
				PaymentReference: row.BillingReference, Reference: "verification-refund:" + request.CaseId, Full: true, Reason: "Checkmark verification rejected: " + reason,
			})
		}
		if _, err := payments.RefundBillingSubscriptionCharge(ctx, row.BillingReference, "verification-refund:"+request.CaseId, "Checkmark verification rejected: "+reason); err != nil {
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
	if IsWebCheckoutChannel(row.Channel) && row.BillingReference != "" && !KeepsPlanOnRejection(row.PlanCode) {
		if err := payments.CancelBillingSubscription(ctx, row.BillingReference); err != nil && !errors.Is(err, paymentservices.ErrPaymentNotFound) {
			return "", err
		}
	}
	return "notCharged", nil
}
