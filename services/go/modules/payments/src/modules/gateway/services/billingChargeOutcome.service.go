package services

import (
	"context"
	"errors"
	"net/http"
	"time"

	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
)

const (
	BillingChargeNotStarted       = "not_started"
	billingChargeUnknownWindow    = time.Hour
	billingChargeNeverSentAfter   = 2 * time.Minute
	billingChargeNeverSentMessage = "the charge never reached the provider"
)

func (gateway *PaymentGateway) ConfirmPreviousBillingCharge(ctx context.Context, reference string) (string, error) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	intent, err := client.PaymentIntent.Query().Where(paymentintent.Reference(reference)).Only(ctx)
	if ent.IsNotFound(err) {
		return BillingChargeNotStarted, nil
	}
	if err != nil {
		return "", err
	}
	if !isSettleable(intent.Status) {
		return map[bool]string{true: BillingChargeSucceeded, false: BillingChargeFailed}[intent.Status == paymentintent.StatusSucceeded], nil
	}
	age := gateway.Container.Now().Sub(intent.CreatedAt)
	provider, err := gateway.Container.Provider(intent.Provider)
	if err != nil {
		return "", err
	}
	_, verifyErr := provider.VerifyCharge(ctx, interfaces.ChargeLookup{Reference: reference})
	var requestError *integrations.ProviderRequestError
	if errors.As(verifyErr, &requestError) && requestError.StatusCode == http.StatusNotFound {
		if age < billingChargeNeverSentAfter {
			return BillingChargePending, nil
		}
		err := intent.Update().Where(paymentintent.StatusEQ(paymentintent.StatusPending)).SetStatus(paymentintent.StatusFailed).
			SetFailureReason(billingChargeNeverSentMessage).SetFailedAt(gateway.Container.Now()).Exec(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return "", err
		}
		return BillingChargeFailed, nil
	}
	if verifyErr != nil {
		return BillingChargePending, nil
	}
	result, err := gateway.settleBillingCharge(ctx, reference, BillingAuthorizationChargeResult{Reference: reference})
	if err != nil {
		return "", err
	}
	if result.Status == BillingChargePending && age >= billingChargeUnknownWindow {
		return BillingChargeFailed, nil
	}
	return result.Status, nil
}
