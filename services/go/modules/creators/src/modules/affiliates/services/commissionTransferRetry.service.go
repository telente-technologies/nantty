package services

import (
	"context"
	"database/sql"
	"time"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/affiliatecommission"
	paymentent "nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/providermovement"
)

const maximumCommissionTransferAttempts = 6

func commissionRetryDelay(attempts int) time.Duration {
	return time.Duration(1<<min(attempts-1, 10)) * time.Minute
}

type transferReadiness struct {
	attempts   int
	ready      bool
	retryAfter *time.Time
}

// commissionTransferAttempt numbers the next transfer so a retry after a refused one gets fresh journal and movement references,
// backing off between failures and giving up (with an alert) after maximumCommissionTransferAttempts.
// The provider movements are the source of truth; the commission's transfer_attempts and retry_after only let the sweep skip rows cheaply.
func (affiliates Affiliates) commissionTransferAttempt(ctx context.Context, transaction *sql.Tx, commission *ent.AffiliateCommission) (transferReadiness, error) {
	payments := affiliates.Container.Payments
	attempts, err := payments.CountMovementsBySubject(ctx, transaction, MovementAffiliateCommission, commission.ID.String())
	if err != nil || attempts == 0 {
		return transferReadiness{attempts: attempts, ready: err == nil}, err
	}
	if attempts >= maximumCommissionTransferAttempts {
		return transferReadiness{attempts: attempts}, nil
	}
	latest, err := payments.FindMovementBySubject(ctx, transaction, MovementAffiliateCommission, commission.ID.String())
	if err != nil {
		return transferReadiness{attempts: attempts}, err
	}
	return readinessAfter(latest, attempts, affiliates.Container.Now()), nil
}

func readinessAfter(latest *paymentent.ProviderMovement, attempts int, now time.Time) transferReadiness {
	if latest == nil || latest.Status != providermovement.StatusFailed || latest.FinishedAt == nil {
		return transferReadiness{attempts: attempts, ready: latest == nil}
	}
	retryAfter := latest.FinishedAt.Add(commissionRetryDelay(attempts)).UTC()
	return transferReadiness{attempts: attempts, ready: !now.Before(retryAfter), retryAfter: &retryAfter}
}

func rememberReadiness(ctx context.Context, client *ent.Client, commission *ent.AffiliateCommission, readiness transferReadiness) error {
	if commission.TransferAttempts == readiness.attempts && sameTime(commission.RetryAfter, readiness.retryAfter) {
		return nil
	}
	return client.AffiliateCommission.UpdateOne(commission).SetTransferAttempts(readiness.attempts).SetNillableRetryAfter(readiness.retryAfter).Exec(ctx)
}

func sameTime(left, right *time.Time) bool {
	return (left == nil) == (right == nil) && (left == nil || left.Equal(*right))
}

// recordFailedCommissionTransfer puts the commission back to pending with its back-off, and alerts once the retries are used up.
func (affiliates Affiliates) recordFailedCommissionTransfer(ctx context.Context, transaction *sql.Tx, client *ent.Client, commission *ent.AffiliateCommission, reason string) error {
	payments := affiliates.Container.Payments
	attempts, err := payments.CountMovementsBySubject(ctx, transaction, MovementAffiliateCommission, commission.ID.String())
	if err != nil {
		return err
	}
	if attempts >= maximumCommissionTransferAttempts {
		payments.RecordPaymentAlertMetric(ctx, "affiliateCommissionTransferGaveUp", "commissionId", commission.ID.String(), "attempts", attempts, "reason", reason)
	}
	retryAfter := affiliates.Container.Now().UTC().Add(commissionRetryDelay(max(attempts, 1)))
	return client.AffiliateCommission.UpdateOne(commission).SetStatus(affiliatecommission.StatusPending).
		SetTransferAttempts(attempts).SetRetryAfter(retryAfter).Exec(ctx)
}
