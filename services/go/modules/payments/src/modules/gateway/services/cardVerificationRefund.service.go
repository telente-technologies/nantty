package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentrefund"
)

var CardVerificationRefundRetryDelays = []time.Duration{5 * time.Second, 30 * time.Second, 2 * time.Minute}

var errCardVerificationRefundRejected = errors.New("the provider rejected the card verification refund")

type RefundAttemptOutcome struct {
	Sent      bool
	Retryable bool
	Err       error
}

// RunRefundAttemptsUntilSent makes the first attempt straight away and retries transient failures on the given
// delays; a definitive rejection or running out of retries raises the alert.
func RunRefundAttemptsUntilSent(ctx context.Context, attempt func(context.Context) RefundAttemptOutcome, delays []time.Duration, wait func(context.Context, time.Duration) bool, alert func(error)) bool {
	outcome := attempt(ctx)
	for index := 0; !outcome.Sent && outcome.Retryable && index < len(delays); index++ {
		if !wait(ctx, delays[index]) {
			break
		}
		outcome = attempt(ctx)
	}
	if !outcome.Sent {
		alert(errors.Join(errCardVerificationRefundRejected, outcome.Err))
	}
	return outcome.Sent
}

func WaitOrStop(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

// refundCardVerificationImmediately sends the verification refund the moment the card authorisation is captured
// instead of waiting for the five-minute refund sweep. The first attempt runs inline; retries continue in the
// background so the person's request is not held up.
func (gateway *PaymentGateway) refundCardVerificationImmediately(ctx context.Context, intentId uuid.UUID) {
	attempt := func(ctx context.Context) RefundAttemptOutcome {
		return gateway.attemptCardVerificationRefund(ctx, intentId)
	}
	alert := func(err error) { gateway.alertCardVerificationRefundFailed(context.WithoutCancel(ctx), intentId, err) }
	first := attempt(ctx)
	if first.Sent {
		return
	}
	if !first.Retryable {
		alert(first.Err)
		return
	}
	background := context.WithoutCancel(ctx)
	go func() {
		if WaitOrStop(background, CardVerificationRefundRetryDelays[0]) {
			RunRefundAttemptsUntilSent(background, attempt, CardVerificationRefundRetryDelays[1:], WaitOrStop, alert)
		}
	}()
}

func (gateway *PaymentGateway) attemptCardVerificationRefund(ctx context.Context, intentId uuid.UUID) RefundAttemptOutcome {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	refunds, err := client.PaymentRefund.Query().Where(paymentrefund.PaymentIntentID(intentId)).All(ctx)
	if err != nil {
		return RefundAttemptOutcome{Retryable: true, Err: err}
	}
	if len(refunds) == 0 {
		return RefundAttemptOutcome{Retryable: true, Err: errors.New("no refund recorded yet")}
	}
	for _, refund := range refunds {
		if refund.Status == paymentrefund.StatusPending {
			if err := gateway.SendPendingRefundToProvider(ctx, refund.ID); err != nil {
				return RefundAttemptOutcome{Retryable: true, Err: err}
			}
			if refund, err = client.PaymentRefund.Get(ctx, refund.ID); err != nil {
				return RefundAttemptOutcome{Retryable: true, Err: err}
			}
		}
		if outcome := classifyCardVerificationRefund(refund); !outcome.Sent {
			if outcome.Retryable && refund.Status == paymentrefund.StatusProcessing {
				_ = gateway.returnRefundToPendingQueue(ctx, refund.ID, refund.FailureReason)
			}
			return outcome
		}
	}
	return RefundAttemptOutcome{Sent: true}
}

func classifyCardVerificationRefund(refund *ent.PaymentRefund) RefundAttemptOutcome {
	switch {
	case refund.Status == paymentrefund.StatusFailed:
		return RefundAttemptOutcome{Err: errors.New(refund.FailureReason)}
	case refund.Status == paymentrefund.StatusProcessing && strings.HasPrefix(refund.FailureReason, "provider call failed"):
		return RefundAttemptOutcome{Retryable: true, Err: errors.New(refund.FailureReason)}
	case refund.Status == paymentrefund.StatusPending:
		return RefundAttemptOutcome{Retryable: true}
	}
	return RefundAttemptOutcome{Sent: true}
}

func (gateway *PaymentGateway) alertCardVerificationRefundFailed(ctx context.Context, intentId uuid.UUID, cause error) {
	gateway.Container.Resources.Logger.ErrorContext(ctx, "ALERT card verification refund failed; refund it by hand", "paymentIntentId", intentId.String(), "error", cause.Error())
	_ = databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "cardVerification.refundFailed", intentId.String(), gateway.Container.Now().UTC(), map[string]any{
			"paymentIntentId": intentId.String(), "reason": truncateReason(cause.Error()), "alert": true,
		})
	})
}
