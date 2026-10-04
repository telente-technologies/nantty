package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/orderpayable"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

func (gateway *PaymentGateway) VerifyAndSettlePaymentIntentByReference(ctx context.Context, reference string) (models.PaymentIntentView, error) {
	return gateway.verifyAndSettlePaymentIntent(ctx, reference, "")
}

func (gateway *PaymentGateway) verifyAndSettlePaymentIntent(ctx context.Context, reference, providerChargeIdHint string) (models.PaymentIntentView, error) {
	database := gateway.Container.Resources.Database
	intent, err := gateway.Container.Client(database).PaymentIntent.Query().Where(paymentintent.Reference(reference)).Only(ctx)
	if ent.IsNotFound(err) {
		return models.PaymentIntentView{}, ErrPaymentNotFound
	}
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	if !isSettleable(intent.Status) {
		return ConvertPaymentIntentToView(intent), nil
	}
	provider, err := gateway.Container.Provider(intent.Provider)
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	verification, err := provider.VerifyCharge(ctx, interfaces.ChargeLookup{Reference: reference})
	if err != nil {
		return models.PaymentIntentView{}, convertProviderError(err)
	}
	verification.Reference = reference
	if providerChargeIdHint != "" {
		verification.ProviderChargeId = providerChargeIdHint
	}
	if verification.Outcome == interfaces.OutcomePending {
		return ConvertPaymentIntentToView(intent), nil
	}
	var settled *ent.PaymentIntent
	var mismatch bool
	var duplicateRefund *RequestedRefund
	err = databases.RunInMoneyTransaction(ctx, database, func(ctx context.Context, transaction *sql.Tx) error {
		duplicateRefund = nil
		settled, mismatch, duplicateRefund, err = gateway.applyVerificationInTransaction(ctx, transaction, intent.ID.String(), verification)
		return err
	})
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	if duplicateRefund != nil {
		_ = gateway.SendPendingRefundToProvider(ctx, duplicateRefund.RefundId)
	}
	if settled != nil && string(settled.Purpose) == constants.PurposeCardVerification && settled.Status == paymentintent.StatusSucceeded {
		gateway.refundCardVerificationImmediately(ctx, settled.ID)
	}
	if mismatch {
		return ConvertPaymentIntentToView(settled), ErrPaymentAmountMismatch
	}
	return ConvertPaymentIntentToView(settled), nil
}

func isSettleable(status paymentintent.Status) bool {
	return status == paymentintent.StatusPending || status == paymentintent.StatusCancelled
}

func (gateway *PaymentGateway) applyVerificationInTransaction(ctx context.Context, transaction *sql.Tx, intentId string, verification interfaces.ChargeVerification) (*ent.PaymentIntent, bool, *RequestedRefund, error) {
	intent, mismatch, err := gateway.applyVerificationToIntent(ctx, transaction, intentId, verification)
	if err != nil || intent == nil || intent.Status != paymentintent.StatusSucceeded || intent.FailureReason != duplicatePaymentReason {
		return intent, mismatch, nil, err
	}
	refund, err := gateway.refundDuplicatePaymentInTransaction(ctx, transaction, intent)
	return intent, false, &refund, err
}

const duplicatePaymentReason = "duplicatePaymentRefunded"

func (gateway *PaymentGateway) applyVerificationToIntent(ctx context.Context, transaction *sql.Tx, intentId string, verification interfaces.ChargeVerification) (*ent.PaymentIntent, bool, error) {
	client := gateway.Container.Client(transaction)
	subject, err := client.PaymentIntent.Query().Where(paymentintent.Reference(verification.Reference)).Only(ctx)
	if err != nil {
		return nil, false, err
	}
	if err := lockPaymentSubject(ctx, transaction, string(subject.Purpose), subject.SubjectID); err != nil {
		return nil, false, err
	}
	intent, err := client.PaymentIntent.Query().Where(paymentintent.Reference(verification.Reference)).ForUpdate().Only(ctx)
	if err != nil {
		return nil, false, err
	}
	if intent.ID.String() != intentId {
		return nil, false, fmt.Errorf("provider returned reference %q for another payment", verification.Reference)
	}
	if !isSettleable(intent.Status) || (intent.Status == paymentintent.StatusCancelled && verification.Outcome == interfaces.OutcomeFailed) {
		return intent, false, nil
	}
	now := gateway.Container.Now().UTC()
	paidElsewhere, err := client.PaymentIntent.Query().Where(
		paymentintent.PurposeEQ(intent.Purpose), paymentintent.SubjectID(intent.SubjectID), paymentintent.StatusEQ(paymentintent.StatusSucceeded), paymentintent.IDNEQ(intent.ID),
	).Exist(ctx)
	if err != nil {
		return nil, false, err
	}
	amountMatches := verification.AmountMinor == intent.AmountMinor && verification.Currency == intent.Currency
	if verification.Outcome == interfaces.OutcomeFailed || !amountMatches {
		reason := verification.FailureReason
		if !amountMatches {
			reason = fmt.Sprintf("amountMismatch: provider reported %d %s", verification.AmountMinor, verification.Currency)
		}
		failed, err := intent.Update().Where(paymentintent.Version(intent.Version)).AddVersion(1).
			SetStatus(paymentintent.StatusFailed).SetFailureReason(truncateReason(reason)).SetFailedAt(now).
			SetProviderTransactionID(verification.ProviderChargeId).Save(ctx)
		if err != nil {
			return nil, false, err
		}
		if err := gateway.notifyPurposeOfFailure(ctx, transaction, failed); err != nil {
			return nil, false, err
		}
		eventType := "payment.failed"
		if !amountMatches {
			eventType = "paymentAmountMismatch.detected"
		}
		return failed, !amountMatches, gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, eventType, failed.ID.String(), now, paymentEventData(failed))
	}
	update := intent.Update().Where(paymentintent.Version(intent.Version)).AddVersion(1).
		SetStatus(paymentintent.StatusSucceeded).SetPaidAt(now).SetProviderTransactionID(verification.ProviderChargeId).
		SetProviderFeeMinor(max(verification.ProviderFeeMinor, 0)).SetFailureReason("")
	if paidElsewhere {
		update.SetFailureReason(duplicatePaymentReason)
	}
	succeeded, err := update.Save(ctx)
	if err != nil {
		return nil, false, err
	}
	if err := gateway.postCollectionJournalEntries(ctx, transaction, succeeded); err != nil {
		return nil, false, err
	}
	if paidElsewhere {
		return succeeded, false, nil
	}
	handler, err := gateway.purposeHandler(string(succeeded.Purpose))
	if err != nil {
		return nil, false, err
	}
	settledPayment, err := gateway.buildSettledPayment(ctx, client, succeeded)
	if err != nil {
		return nil, false, err
	}
	settledPayment.ProviderCustomerId = verification.ProviderCustomerId
	if card := verification.Authorization; card != nil {
		settledPayment.Authorization = &models.CardAuthorizationHandoff{
			AuthorizationCode: card.AuthorizationCode, Signature: card.Signature, Brand: card.Brand, Last4: card.Last4, ExpiryMonth: card.ExpiryMonth, ExpiryYear: card.ExpiryYear, Reusable: card.Reusable,
		}
	}
	if err := gateway.recordProviderCustomerInTransaction(ctx, client, succeeded.OwnerUserID, succeeded.Provider, verification.ProviderCustomerId); err != nil {
		return nil, false, err
	}
	if err := handler.HandleSucceededPayment(ctx, transaction, settledPayment); err != nil {
		return nil, false, err
	}
	return succeeded, false, gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payment.succeeded", succeeded.ID.String(), now, paymentEventData(succeeded))
}

func (gateway *PaymentGateway) notifyPurposeOfFailure(ctx context.Context, transaction *sql.Tx, intent *ent.PaymentIntent) error {
	handler, err := gateway.purposeHandler(string(intent.Purpose))
	if err != nil {
		return err
	}
	payment, err := gateway.buildSettledPayment(ctx, gateway.Container.Client(transaction), intent)
	if err != nil {
		return err
	}
	return handler.HandleFailedPayment(ctx, transaction, payment)
}

func (gateway *PaymentGateway) buildSettledPayment(ctx context.Context, client *ent.Client, intent *ent.PaymentIntent) (models.SettledPayment, error) {
	payment := models.SettledPayment{
		IntentId: intent.ID, Reference: intent.Reference, Purpose: string(intent.Purpose), OwnerUserId: intent.OwnerUserID,
		SubjectId: intent.SubjectID, Provider: intent.Provider, AmountMinor: intent.AmountMinor, AppliedAmountMinor: AppliedCollectionAmount(intent), Currency: intent.Currency,
		ConnectedAccountId: intent.ConnectedAccountID, BeneficiaryUserId: intent.BeneficiaryUserID, PlatformFeeMinor: intent.PlatformFeeMinor,
		ProviderFeeMinor: intent.ProviderFeeMinor, ProviderTransactionId: intent.ProviderTransactionID, FailureReason: intent.FailureReason,
		SettledAt: gateway.Container.Now().UTC(),
	}
	if intent.Purpose != constants.PurposeOrderCheckout {
		return payment, nil
	}
	groups := checkoutGroupsOf(intent)
	query := client.OrderPayable.Query().Where(orderpayable.OrderID(intent.SubjectID))
	if len(groups) > 0 {
		query = client.OrderPayable.Query().Where(orderpayable.CheckoutID(intent.SubjectID))
		payment.GroupAllocations = models.SettleCheckoutGroups(groups, intent.ProviderFeeMinor)
	}
	payables, err := query.Order(ent.Asc(orderpayable.FieldCreatedAt)).All(ctx)
	if err != nil {
		return payment, err
	}
	if len(payables) == 0 {
		return payment, errors.New("order has no registered payable")
	}
	for _, payable := range payables {
		payment.OrderPayables = append(payment.OrderPayables, ConvertOrderPayable(payable))
	}
	return payment, nil
}

func ConvertOrderPayable(payable *ent.OrderPayable) models.OrderPayable {
	return models.OrderPayable{
		CheckoutId: payable.CheckoutID, OrderId: payable.OrderID, OrderReference: payable.OrderReference, BuyerUserId: payable.BuyerUserID,
		StoreId: payable.StoreID, SellerUserId: payable.SellerUserID, AmountMinor: payable.AmountMinor, Currency: payable.Currency, ProductSummary: payable.ProductSummary,
		PaymentMode: string(payable.PaymentMode), StoreVerified: payable.StoreVerified,
	}
}

func paymentEventData(intent *ent.PaymentIntent) map[string]any {
	return map[string]any{
		"paymentId": intent.ID.String(), "reference": intent.Reference, "purpose": string(intent.Purpose), "subjectId": intent.SubjectID,
		"ownerUserId": intent.OwnerUserID, "provider": intent.Provider, "status": string(intent.Status),
		"amount": map[string]any{"amountMinor": intent.AmountMinor, "currency": intent.Currency},
	}
}

func truncateReason(reason string) string {
	if len(reason) > 300 {
		return reason[:300]
	}
	return reason
}
