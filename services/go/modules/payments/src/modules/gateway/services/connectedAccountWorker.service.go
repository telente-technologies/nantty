package services

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/connectedaccount"
	"nantty/modules/payments/src/generated/ent/connectedaccountjob"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/platform/httpserver"
)

var (
	ErrPayoutAccountNotReady = httpserver.NewApiError(http.StatusConflict, "ACCOUNT_NOT_READY", "Your payout account is still being set up. Try again shortly.")
	ErrPartnerUnavailable    = httpserver.NewApiError(http.StatusServiceUnavailable, "PARTNER_UNAVAILABLE", "Our payment partner is unavailable. Try again in a few minutes.")
)

type ConnectedAccountJobReport struct {
	Succeeded int `json:"succeeded"`
	Retried   int `json:"retried"`
	Failed    int `json:"failed"`
	Waiting   int `json:"waiting"`
}

func (gateway *PaymentGateway) ProcessDueConnectedAccountJobs(ctx context.Context, limit int) ConnectedAccountJobReport {
	report := ConnectedAccountJobReport{}
	for processed := 0; processed < limit; processed++ {
		job, err := gateway.claimDueConnectedAccountJob(ctx)
		if err != nil {
			gateway.Container.Resources.Logger.ErrorContext(ctx, "claiming a payout account job failed", slog.Any("error", err))
			return report
		}
		if job == nil {
			return report
		}
		result, stepError := gateway.executeConnectedAccountStep(ctx, job)
		outcome, err := gateway.recordConnectedAccountJobOutcome(ctx, job, result, stepError)
		if err != nil {
			gateway.Container.Resources.Logger.ErrorContext(ctx, "recording a payout account job failed", slog.String("jobId", job.ID.String()), slog.Any("error", err))
			return report
		}
		switch outcome {
		case "succeeded":
			report.Succeeded++
		case "retried":
			report.Retried++
		case "waiting":
			report.Waiting++
		default:
			report.Failed++
		}
	}
	return report
}

func (gateway *PaymentGateway) claimDueConnectedAccountJob(ctx context.Context) (*ent.ConnectedAccountJob, error) {
	var claimed *ent.ConnectedAccountJob
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		now := gateway.Container.Now().UTC()
		due, err := client.ConnectedAccountJob.Query().Where(connectedaccountjob.StatusEQ(connectedaccountjob.StatusQueued), connectedaccountjob.NextAttemptAtLTE(now)).
			Order(ent.Asc(connectedaccountjob.FieldNextAttemptAt)).ForUpdate(entsql.WithLockAction(entsql.SkipLocked)).First(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		claimed, err = due.Update().SetStatus(connectedaccountjob.StatusRunning).SetLastAttemptAt(now).Save(ctx)
		return err
	})
	return claimed, err
}

func (gateway *PaymentGateway) recordConnectedAccountJobOutcome(ctx context.Context, job *ent.ConnectedAccountJob, result any, stepError error) (string, error) {
	outcome := "succeeded"
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		now := gateway.Container.Now().UTC()
		update := client.ConnectedAccountJob.UpdateOneID(job.ID)
		switch {
		case stepError == nil:
			update.SetStatus(connectedaccountjob.StatusSucceeded).SetCompletedAt(now).SetLastError("")
			if result != nil {
				sealed, err := gateway.sealSensitivePayload(result)
				if err != nil {
					return err
				}
				update.SetSealedResult(sealed)
			}
			return update.Exec(ctx)
		}
		failedAttempts := job.AttemptCount + 1
		message := truncate(stepError.Error(), 500)
		if errors.Is(stepError, ErrBankAccountAlreadyLinked) {
			outcome = "failed"
			message = duplicateBankAccountCode + ": " + ErrBankAccountAlreadyLinked.Message
			if err := update.SetStatus(connectedaccountjob.StatusFailed).SetAttemptCount(failedAttempts).SetLastError(message).Exec(ctx); err != nil {
				return err
			}
			return client.ConnectedAccount.Update().Where(connectedaccount.UserID(job.UserID)).SetLastError(message).Exec(ctx)
		}
		if delay, retry := models.NextConnectedAccountJobAttemptDelay(failedAttempts); retry {
			outcome = "retried"
			return update.SetStatus(connectedaccountjob.StatusQueued).SetAttemptCount(failedAttempts).SetNextAttemptAt(now.Add(delay)).SetLastError(message).Exec(ctx)
		}
		outcome = "failed"
		if err := update.SetStatus(connectedaccountjob.StatusFailed).SetAttemptCount(failedAttempts).SetLastError(message).Exec(ctx); err != nil {
			return err
		}
		return gateway.deadLetterConnectedAccountJob(ctx, transaction, job, message, now)
	})
	return outcome, err
}

func (gateway *PaymentGateway) deadLetterConnectedAccountJob(ctx context.Context, transaction *sql.Tx, job *ent.ConnectedAccountJob, message string, now time.Time) error {
	gateway.Container.Resources.Logger.ErrorContext(ctx, "payout account job dead-lettered", slog.String("jobId", job.ID.String()), slog.String("step", string(job.Step)), slog.String("userId", job.UserID))
	data := map[string]any{"userId": job.UserID, "jobId": job.ID.String(), "step": string(job.Step), "lastError": message}
	if err := gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payoutAccount.jobDeadLettered", job.ID.String(), now, data); err != nil {
		return err
	}
	if job.Step != connectedaccountjob.StepCreateRecipient {
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payoutAccount.actionRequired", job.UserID, now, map[string]any{"userId": job.UserID, "reason": "setupStepFailed", "step": string(job.Step)})
	}
	if err := gateway.Container.Client(transaction).ConnectedAccount.Update().Where(connectedaccount.UserID(job.UserID), connectedaccount.StatusEQ(connectedaccount.StatusPendingCreation)).
		SetStatus(connectedaccount.StatusFailed).SetLastError(message).Exec(ctx); err != nil {
		return err
	}
	return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payoutAccount.creationFailed", job.UserID, now, map[string]any{"userId": job.UserID, "lastError": message})
}

func (gateway *PaymentGateway) ReconcileStuckConnectedAccounts(ctx context.Context, olderThan time.Duration) (int, error) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	now := gateway.Container.Now().UTC()
	requeued, err := client.ConnectedAccountJob.Update().
		Where(connectedaccountjob.StatusEQ(connectedaccountjob.StatusFailed), connectedaccountjob.UpdatedAtLT(now.Add(-olderThan)),
			connectedaccountjob.Not(connectedaccountjob.LastErrorHasPrefix(duplicateBankAccountCode))).
		SetStatus(connectedaccountjob.StatusQueued).SetAttemptCount(0).SetNextAttemptAt(now).Save(ctx)
	if err != nil {
		return 0, err
	}
	stalled, err := client.ConnectedAccountJob.Update().
		Where(connectedaccountjob.StatusEQ(connectedaccountjob.StatusRunning), connectedaccountjob.UpdatedAtLT(now.Add(-time.Hour))).
		SetStatus(connectedaccountjob.StatusQueued).SetNextAttemptAt(now).Save(ctx)
	if err != nil {
		return requeued, err
	}
	return requeued + stalled, nil
}
