package services

import (
	"context"
	"database/sql"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptioncoveredprofile"
)

func (billing Billing) handleCombinedGoldVerificationRefund(ctx context.Context, row *ent.Subscription, request VerificationRefundRequest) error {
	if request.ProfileId == "" {
		billing.Container.Resources.Logger.ErrorContext(ctx, "ALERT combined Gold verification refund without a profile; settle it by hand", "subscriptionId", row.ID.String(), "caseId", request.CaseId)
		return nil
	}
	var covered *ent.SubscriptionCoveredProfile
	err := databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := billing.Container.Client(transaction)
		locked, err := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()), subscriptioncoveredprofile.ProfileID(request.ProfileId)).
			Order(ent.Desc(subscriptioncoveredprofile.FieldCreatedAt)).ForUpdate().First(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil || locked.RefundState == verificationRefundDone {
			return err
		}
		if locked.RefundState == verificationRefundPending {
			covered = locked
			return nil
		}
		wasGranted := locked.Status == subscriptioncoveredprofile.StatusActive || locked.Status == subscriptioncoveredprofile.StatusRemoving
		if covered, err = locked.Update().SetStatus(subscriptioncoveredprofile.StatusRejected).SetEndedAt(billing.Container.Now().UTC()).SetRefundState(verificationRefundPending).Save(ctx); err != nil {
			return err
		}
		if wasGranted {
			if err := billing.enqueueCoveredEntitlementInTransaction(ctx, transaction, "entitlement.revoked", locked.ProfileID, entitlementData(row, "rejected")); err != nil {
				return err
			}
		}
		return billing.cancelCombinedGoldWhenNothingRenewsInTransaction(ctx, client, row)
	})
	if err != nil || covered == nil {
		return err
	}
	share := covered.ShareMinor
	path := RefundPathNothingCharged
	if share > 0 && covered.SharePaymentReference != "" && IsWebCheckoutChannel(row.Channel) {
		path = RefundPathCardShare
	}
	outcome := "notCharged"
	if path == RefundPathCardShare {
		charged := *row
		charged.BillingReference = covered.SharePaymentReference
		if outcome, err = billing.refundCheckmarkShareToCard(ctx, &charged, share, request); err != nil {
			return err
		}
	}
	return databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := billing.Container.Client(transaction)
		locked, err := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.ID(covered.ID)).ForUpdate().Only(ctx)
		if err != nil || locked.RefundState == verificationRefundDone {
			return err
		}
		if err := locked.Update().SetRefundState(verificationRefundDone).Exec(ctx); err != nil {
			return err
		}
		data := map[string]any{
			"caseId": request.CaseId, "subscriptionId": row.ID.String(), "accountId": row.OwnerUserID, "profileId": covered.ProfileID, "channel": row.Channel.String(),
			"amount": money(row.AmountMinor, row.Currency), "path": string(path), "refundScope": "checkmark_share",
		}
		if share > 0 && path == RefundPathCardShare {
			data["refundAmount"] = money(share, row.Currency)
		}
		return billing.emit(ctx, transaction, "verificationRefund."+outcome, row.ID.String(), data)
	})
}
