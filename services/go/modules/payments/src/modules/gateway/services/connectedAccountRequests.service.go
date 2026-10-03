package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/connectedaccount"
	"zudomart/modules/payments/src/generated/ent/connectedaccountjob"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
	"zudomart/platform/secretbox"
)

var (
	ErrConnectedAccountJobNotFound  = httpserver.NewApiError(http.StatusNotFound, "PAYOUT_ACCOUNT_JOB_NOT_FOUND", "We could not find that payout setup step.")
	ErrConnectedAccountJobRateLimit = httpserver.NewApiError(http.StatusTooManyRequests, "PAYOUT_ACCOUNT_RETRY_TOO_SOON", "Please wait a minute before trying again.")
	ErrSensitiveStorageUnavailable  = httpserver.NewApiError(http.StatusServiceUnavailable, "SENSITIVE_STORAGE_UNAVAILABLE", "We cannot save these details right now. Try again later.")
)

func (gateway *PaymentGateway) FindConnectedAccountRowForUser(ctx context.Context, executor databases.ExecutorQuerier, userId string) (*ent.ConnectedAccount, error) {
	account, err := gateway.Container.Client(executor).ConnectedAccount.Query().
		Where(connectedaccount.UserID(userId), connectedaccount.Provider(gateway.Container.Settings.DefaultProvider)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrConnectedAccountMissing
	}
	return account, err
}

func (gateway *PaymentGateway) EnsureConnectedAccountForRole(ctx context.Context, userId, role string) (*ent.ConnectedAccount, error) {
	if _, err := gateway.requireVerifiedContact(ctx, userId); err != nil {
		return nil, err
	}
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "connected-account:"+userId); err != nil {
			return err
		}
		existing, err := gateway.FindConnectedAccountRowForUser(ctx, transaction, userId)
		if errors.Is(err, ErrConnectedAccountMissing) {
			return gateway.insertPendingConnectedAccount(ctx, transaction, userId, role)
		}
		if err != nil || slices.Contains(existing.Roles, role) {
			return err
		}
		if err := existing.Update().SetRoles(append(append([]string{}, existing.Roles...), role)).AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		if role == constants.ConnectedAccountRoleSeller && existing.SettlementSubaccountCode == "" && existing.BankCode != "" {
			return gateway.enqueueSubaccountStepsFromLatestBankInTransaction(ctx, transaction, userId)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return gateway.FindConnectedAccountRowForUser(ctx, gateway.Container.Resources.Database, userId)
}

func (gateway *PaymentGateway) insertPendingConnectedAccount(ctx context.Context, transaction *sql.Tx, userId, role string) error {
	now := gateway.Container.Now().UTC()
	empty, _ := json.Marshal(map[string]string{})
	none, _ := json.Marshal([]string{})
	account, err := gateway.Container.Client(transaction).ConnectedAccount.Create().SetUserID(userId).SetProvider(gateway.Container.Settings.DefaultProvider).
		SetStatus(connectedaccount.StatusPendingCreation).SetAcceptsPayments(role == constants.ConnectedAccountRoleSeller).SetRoles([]string{role}).
		SetCapabilityStatuses(empty).SetOutstandingRequirements(none).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return err
	}
	return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payoutAccount.creationRequested", account.ID.String(), now, map[string]any{
		"payoutAccountId": account.ID.String(), "userId": userId, "role": role,
	})
}

func (gateway *PaymentGateway) EnqueueConnectedAccountStep(ctx context.Context, userId, step string, payload any) (models.ConnectedAccountJobView, error) {
	var job *ent.ConnectedAccountJob
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if _, err := gateway.FindConnectedAccountRowForUser(ctx, transaction, userId); err != nil {
			return err
		}
		var err error
		job, err = gateway.enqueueConnectedAccountStepInTransaction(ctx, transaction, userId, step, payload)
		return err
	})
	if err != nil {
		return models.ConnectedAccountJobView{}, err
	}
	return gateway.convertConnectedAccountJob(job), nil
}

func (gateway *PaymentGateway) enqueueConnectedAccountStepInTransaction(ctx context.Context, transaction *sql.Tx, userId, step string, payload any) (*ent.ConnectedAccountJob, error) {
	client := gateway.Container.Client(transaction)
	if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "connected-account-job:"+userId+":"+step); err != nil {
		return nil, err
	}
	version, err := client.ConnectedAccountJob.Query().Where(connectedaccountjob.UserID(userId), connectedaccountjob.StepEQ(connectedaccountjob.Step(step))).Count(ctx)
	if err != nil {
		return nil, err
	}
	create := client.ConnectedAccountJob.Create().SetUserID(userId).SetStep(connectedaccountjob.Step(step)).SetVersion(version + 1).
		SetIdempotencyKey(models.ConnectedAccountJobIdempotencyKey(step, userId, version+1)).SetNextAttemptAt(gateway.Container.Now().UTC()).SetCreatedAt(gateway.Container.Now().UTC())
	if payload != nil {
		sealed, err := gateway.sealSensitivePayload(payload)
		if err != nil {
			return nil, err
		}
		create.SetSealedPayload(sealed)
	}
	return create.Save(ctx)
}

func (gateway *PaymentGateway) sealSensitivePayload(payload any) ([]byte, error) {
	if len(gateway.Container.Settings.DataEncryptionKey) != 32 {
		return nil, ErrSensitiveStorageUnavailable
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return secretbox.SealWithAesGcm(gateway.Container.Settings.DataEncryptionKey, encoded)
}

func (gateway *PaymentGateway) openSensitivePayload(sealed []byte, destination any) error {
	if len(sealed) == 0 {
		return nil
	}
	opened, err := secretbox.OpenWithAesGcm(gateway.Container.Settings.DataEncryptionKey, sealed)
	if err != nil {
		return err
	}
	return json.Unmarshal(opened, destination)
}

func (gateway *PaymentGateway) ReadConnectedAccountJob(ctx context.Context, userId string, jobId uuid.UUID) (models.ConnectedAccountJobView, error) {
	job, err := gateway.Container.Client(gateway.Container.Resources.Database).ConnectedAccountJob.Query().
		Where(connectedaccountjob.ID(jobId), connectedaccountjob.UserID(userId)).Only(ctx)
	if ent.IsNotFound(err) {
		return models.ConnectedAccountJobView{}, ErrConnectedAccountJobNotFound
	}
	if err != nil {
		return models.ConnectedAccountJobView{}, err
	}
	return gateway.convertConnectedAccountJob(job), nil
}

func (gateway *PaymentGateway) RetryConnectedAccountJob(ctx context.Context, userId string, jobId uuid.UUID) (models.ConnectedAccountJobView, error) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	query := client.ConnectedAccountJob.Query().Where(connectedaccountjob.ID(jobId))
	if userId != "" {
		query = query.Where(connectedaccountjob.UserID(userId))
	}
	job, err := query.Only(ctx)
	if ent.IsNotFound(err) {
		return models.ConnectedAccountJobView{}, ErrConnectedAccountJobNotFound
	}
	if err != nil {
		return models.ConnectedAccountJobView{}, err
	}
	now := gateway.Container.Now().UTC()
	if job.LastAttemptAt != nil && now.Sub(*job.LastAttemptAt) < time.Minute {
		return models.ConnectedAccountJobView{}, ErrConnectedAccountJobRateLimit
	}
	if job.Status == connectedaccountjob.StatusFailed {
		if job, err = job.Update().SetStatus(connectedaccountjob.StatusQueued).SetAttemptCount(0).SetNextAttemptAt(now).Save(ctx); err != nil {
			return models.ConnectedAccountJobView{}, err
		}
	}
	return gateway.convertConnectedAccountJob(job), nil
}

func (gateway *PaymentGateway) convertConnectedAccountJob(job *ent.ConnectedAccountJob) models.ConnectedAccountJobView {
	view := models.ConnectedAccountJobView{Id: job.ID.String(), Step: string(job.Step), Status: string(job.Status), AttemptCount: job.AttemptCount, LastError: job.LastError, UpdatedAt: job.UpdatedAt}
	if job.Status == connectedaccountjob.StatusQueued {
		next := job.NextAttemptAt
		view.NextAttemptAt = &next
	}
	if job.SealedResult != nil {
		var result map[string]any
		if gateway.openSensitivePayload(*job.SealedResult, &result) == nil {
			view.Result = result
		}
	}
	return view
}
