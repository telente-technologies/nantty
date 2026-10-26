package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent/idempotentrequest"
	"nantty/modules/payments/src/interfaces"
	"nantty/platform/httpserver"
)

const (
	billingRefundScope          = "billingRefund"
	billingRefundPending        = "pending"
	billingRefundSubmitted      = "submitted"
	billingRefundUnknown        = "unknown"
	billingRefundSucceeded      = "succeeded"
	billingRefundFailed         = "failed"
	billingRefundStaleSubmitted = 2 * time.Minute
)

var (
	ErrRefundInFlight        = httpserver.NewApiError(http.StatusConflict, "REFUND_IN_FLIGHT", "This refund is already being sent. Try again shortly.")
	errBillingRefundRejected = errors.New("the provider rejected this refund")
	errRefundNeedsManualLook = errors.New("the refund outcome is unknown and this provider cannot be asked; confirm it by hand")
)

type billingRefundIntent struct {
	State            string    `json:"state"`
	ProviderRefundId string    `json:"providerRefundId,omitempty"`
	FailureReason    string    `json:"failureReason,omitempty"`
	SubmittedAt      time.Time `json:"submittedAt"`
	Attempts         int       `json:"attempts"`
}

type billingRefundStep string

const (
	billingRefundStepDone   billingRefundStep = "done"
	billingRefundStepSend   billingRefundStep = "send"
	billingRefundStepLookup billingRefundStep = "lookup"
)

func (intent billingRefundIntent) storedResult() (interfaces.RefundResult, error) {
	if intent.State == billingRefundFailed {
		return interfaces.RefundResult{ProviderRefundId: intent.ProviderRefundId, Outcome: interfaces.OutcomeFailed, FailureReason: intent.FailureReason}, errBillingRefundRejected
	}
	return interfaces.RefundResult{ProviderRefundId: intent.ProviderRefundId, Outcome: interfaces.OutcomeSucceeded}, nil
}

func billingRefundHash(request interfaces.RefundRequest) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%d|%s|%t", request.ChargeReference, request.AmountMinor, request.Currency, request.FullRefund)))
	return hex.EncodeToString(sum[:])
}

func (gateway *PaymentGateway) refundBillingChargeOnce(ctx context.Context, provider interfaces.PaymentProvider, request interfaces.RefundRequest, postLedger func(context.Context, *sql.Tx) error) (interfaces.RefundResult, error) {
	step, intent, err := gateway.claimBillingRefund(ctx, request, postLedger, -1)
	if err != nil {
		return interfaces.RefundResult{}, err
	}
	if step == billingRefundStepDone {
		return intent.storedResult()
	}
	if step == billingRefundStepLookup {
		lookup, supported := provider.(interfaces.RefundLookupProvider)
		if !supported {
			return interfaces.RefundResult{}, errRefundNeedsManualLook
		}
		found, exists, err := lookup.FindRefundByReference(ctx, interfaces.RefundLookup{ChargeReference: request.ChargeReference, RefundReference: request.RefundReference, SubmittedAfter: intent.SubmittedAt})
		if err != nil {
			return interfaces.RefundResult{}, err
		}
		if exists {
			return gateway.finishBillingRefund(ctx, request.RefundReference, found, nil)
		}
		if step, intent, err = gateway.claimBillingRefund(ctx, request, nil, intent.Attempts); err != nil {
			return interfaces.RefundResult{}, err
		}
		if step == billingRefundStepDone {
			return intent.storedResult()
		}
		if step != billingRefundStepSend {
			return interfaces.RefundResult{}, ErrRefundInFlight
		}
	}
	result, callErr := provider.RefundCharge(ctx, request)
	return gateway.finishBillingRefund(ctx, request.RefundReference, result, callErr)
}

func (gateway *PaymentGateway) claimBillingRefund(ctx context.Context, request interfaces.RefundRequest, postLedger func(context.Context, *sql.Tx) error, resendAfterAttempts int) (billingRefundStep, billingRefundIntent, error) {
	var step billingRefundStep
	var intent billingRefundIntent
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		initial, _ := json.Marshal(billingRefundIntent{State: billingRefundPending})
		if err := client.IdempotentRequest.Create().SetScope(billingRefundScope).SetKey(request.RefundReference).SetRequestHash(billingRefundHash(request)).
			SetResponseBody(initial).SetCreatedAt(gateway.Container.Now()).OnConflictColumns(idempotentrequest.FieldScope, idempotentrequest.FieldKey).Ignore().Exec(ctx); err != nil {
			return err
		}
		row, err := client.IdempotentRequest.Query().Where(idempotentrequest.Scope(billingRefundScope), idempotentrequest.Key(request.RefundReference)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if row.RequestHash != billingRefundHash(request) {
			return fmt.Errorf("refund reference %s reused with different details", request.RefundReference)
		}
		if row.ResponseBody != nil {
			if err := json.Unmarshal(*row.ResponseBody, &intent); err != nil {
				return err
			}
		}
		now := gateway.Container.Now().UTC()
		switch {
		case intent.State == billingRefundSucceeded || intent.State == billingRefundFailed:
			step = billingRefundStepDone
			return nil
		case intent.State == billingRefundPending:
			if postLedger != nil {
				if err := postLedger(ctx, transaction); err != nil {
					return err
				}
			}
		case resendAfterAttempts != intent.Attempts:
			step = billingRefundStepLookup
			if intent.State == billingRefundSubmitted && now.Sub(intent.SubmittedAt) < billingRefundStaleSubmitted {
				return ErrRefundInFlight
			}
			return nil
		}
		intent.State, intent.SubmittedAt, intent.Attempts, step = billingRefundSubmitted, now, intent.Attempts+1, billingRefundStepSend
		return gateway.saveBillingRefundIntent(ctx, transaction, request.RefundReference, intent)
	})
	return step, intent, err
}

func (gateway *PaymentGateway) finishBillingRefund(ctx context.Context, reference string, result interfaces.RefundResult, callErr error) (interfaces.RefundResult, error) {
	var intent billingRefundIntent
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		row, err := gateway.Container.Client(transaction).IdempotentRequest.Query().Where(idempotentrequest.Scope(billingRefundScope), idempotentrequest.Key(reference)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if row.ResponseBody != nil {
			if err := json.Unmarshal(*row.ResponseBody, &intent); err != nil {
				return err
			}
		}
		if intent.State == billingRefundSucceeded || intent.State == billingRefundFailed {
			return nil
		}
		switch {
		case callErr != nil && IsDefinitiveProviderRejection(callErr):
			intent.State, intent.FailureReason = billingRefundFailed, truncateReason(callErr.Error())
		case callErr != nil:
			intent.State, intent.FailureReason = billingRefundUnknown, truncateReason(callErr.Error())
		case result.Outcome == interfaces.OutcomeFailed:
			intent.State, intent.FailureReason, intent.ProviderRefundId = billingRefundFailed, truncateReason(result.FailureReason), result.ProviderRefundId
		default:
			intent.State, intent.ProviderRefundId = billingRefundSucceeded, result.ProviderRefundId
		}
		return gateway.saveBillingRefundIntent(ctx, transaction, reference, intent)
	})
	if err != nil {
		return interfaces.RefundResult{}, err
	}
	if callErr != nil {
		return result, callErr
	}
	return intent.storedResult()
}

func (gateway *PaymentGateway) saveBillingRefundIntent(ctx context.Context, transaction *sql.Tx, reference string, intent billingRefundIntent) error {
	encoded, err := json.Marshal(intent)
	if err != nil {
		return err
	}
	return gateway.Container.Client(transaction).IdempotentRequest.Update().
		Where(idempotentrequest.Scope(billingRefundScope), idempotentrequest.Key(reference)).SetResponseBody(encoded).Exec(ctx)
}
