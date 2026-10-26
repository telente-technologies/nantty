package services

import (
	"context"
	"database/sql"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	entsql "entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/predicate"
	"nantty/modules/payments/src/generated/ent/webhookevent"
	"nantty/modules/payments/src/integrations/providerHttp"
	"nantty/modules/payments/src/interfaces"
)

const (
	WebhookLeaseDuration     = 5 * time.Minute
	MaximumWebhookAttempts   = 12
	webhookWorkerConcurrency = 4
)

type claimedWebhook struct {
	id       uuid.UUID
	provider string
	eventKey string
	token    string
	attempts int
	payload  []byte
}

func (gateway *PaymentGateway) storeWebhookEvent(ctx context.Context, providerName string, notification interfaces.WebhookNotification, digest, rawBody []byte) (bool, error) {
	create := gateway.Container.Client(gateway.Container.Resources.Database).WebhookEvent.Create().
		SetProvider(providerName).SetEventKey(truncate(notification.EventKey, 255)).SetEventType(truncate(notification.EventType, 120)).
		SetReference(truncate(notification.Reference, 255)).SetPayloadSha256(hex.EncodeToString(digest)).SetCreatedAt(gateway.Container.Now()).
		SetNextAttemptAt(gateway.Container.Now().UTC())
	if rawBody != nil {
		create.SetRawPayload(rawBody)
	}
	err := create.OnConflictColumns(webhookevent.FieldProvider, webhookevent.FieldEventKey).DoNothing().Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (gateway *PaymentGateway) claimDueWebhooks(ctx context.Context, limit int, only ...predicate.WebhookEvent) ([]claimedWebhook, error) {
	var claimed []claimedWebhook
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		claimed = nil
		now := gateway.Container.Now().UTC()
		client := gateway.Container.Client(transaction)
		conditions := append([]predicate.WebhookEvent{
			webhookevent.ProcessedAtIsNil(), webhookevent.DeadLetteredAtIsNil(), webhookevent.RawPayloadNotNil(),
			webhookevent.Or(webhookevent.NextAttemptAtIsNil(), webhookevent.NextAttemptAtLTE(now)),
			webhookevent.Or(webhookevent.LockedUntilIsNil(), webhookevent.LockedUntilLT(now)),
		}, only...)
		due, err := client.WebhookEvent.Query().Where(conditions...).Order(ent.Asc(webhookevent.FieldCreatedAt)).Limit(limit).
			ForUpdate(entsql.WithLockAction(entsql.SkipLocked)).All(ctx)
		if err != nil {
			return err
		}
		for _, event := range due {
			token := uuid.NewString()
			if err := event.Update().SetLockedUntil(now.Add(WebhookLeaseDuration)).SetLeaseToken(token).AddAttemptCount(1).Exec(ctx); err != nil {
				return err
			}
			claimed = append(claimed, claimedWebhook{id: event.ID, provider: event.Provider, eventKey: event.EventKey, token: token, attempts: event.AttemptCount + 1, payload: *event.RawPayload})
		}
		return nil
	})
	return claimed, err
}

func (gateway *PaymentGateway) finishClaimedWebhook(ctx context.Context, claim claimedWebhook, processingError error) error {
	now := gateway.Container.Now().UTC()
	update := gateway.Container.Client(gateway.Container.Resources.Database).WebhookEvent.Update().
		Where(webhookevent.ID(claim.id), webhookevent.LeaseToken(claim.token), webhookevent.ProcessedAtIsNil()).ClearLockedUntil().SetLeaseToken("")
	switch {
	case processingError == nil:
		update.SetProcessedAt(now).SetLastError("")
	case errors.As(processingError, new(webhookNeedsFinanceReview)):
		update.SetDeadLetteredAt(now).SetLastError(truncate(providerhttp.RedactSecrets(processingError.Error()), 1000))
		gateway.RecordPaymentAlertMetric(ctx, "webhookDeadLettered", "provider", claim.provider, "eventKey", claim.eventKey, "reason", processingError.Error())
	case claim.attempts >= MaximumWebhookAttempts:
		update.SetDeadLetteredAt(now).SetLastError(truncate(providerhttp.RedactSecrets(processingError.Error()), 1000))
		gateway.Container.Resources.Logger.ErrorContext(ctx, "webhook moved to the dead-letter state; replay it by hand once fixed", "provider", claim.provider, "eventKey", claim.eventKey, "attempts", claim.attempts)
	default:
		update.SetNextAttemptAt(now.Add(webhookRetryDelay(claim.attempts))).SetLastError(truncate(providerhttp.RedactSecrets(processingError.Error()), 1000))
	}
	updated, err := update.Save(ctx)
	if err == nil && updated == 0 {
		gateway.Container.Resources.Logger.WarnContext(ctx, "webhook lease was lost before the result was recorded", "eventKey", claim.eventKey)
	}
	return err
}

func webhookRetryDelay(attempts int) time.Duration {
	return min(30*time.Second<<min(max(attempts-1, 0), 10), time.Hour)
}

func (gateway *PaymentGateway) processClaimedWebhook(ctx context.Context, claim claimedWebhook, notification *interfaces.WebhookNotification) error {
	work, cancel := context.WithTimeout(ctx, WebhookLeaseDuration/2)
	defer cancel()
	var processingError error
	if notification == nil {
		provider, found := gateway.Container.Providers[claim.provider]
		if !found {
			processingError = errors.New("no adapter is registered for provider " + claim.provider)
		} else if parsed, err := provider.ParseVerifiedWebhookPayload(claim.payload); err != nil {
			processingError = err
		} else {
			notification = &parsed
		}
	}
	if notification != nil {
		processingError = gateway.processVerifiedWebhook(work, *notification)
	}
	if err := gateway.finishClaimedWebhook(context.WithoutCancel(ctx), claim, processingError); err != nil {
		return errors.Join(processingError, err)
	}
	if errors.As(processingError, new(webhookNeedsFinanceReview)) {
		return nil
	}
	return processingError
}

func (gateway *PaymentGateway) ProcessDueWebhooks(ctx context.Context, limit int) int {
	claimed, err := gateway.claimDueWebhooks(ctx, limit)
	if err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "could not claim webhooks", "error", err)
		return 0
	}
	slots := make(chan struct{}, webhookWorkerConcurrency)
	var group sync.WaitGroup
	for _, claim := range claimed {
		slots <- struct{}{}
		group.Add(1)
		go func(claim claimedWebhook) {
			defer func() {
				<-slots
				group.Done()
			}()
			if err := gateway.processClaimedWebhook(ctx, claim, nil); err != nil {
				gateway.Container.Resources.Logger.WarnContext(ctx, "webhook processing failed; it will be retried", "eventKey", claim.eventKey, "attempt", claim.attempts, "error", providerhttp.RedactSecrets(err.Error()))
			}
		}(claim)
	}
	group.Wait()
	return len(claimed)
}

func (gateway *PaymentGateway) RetryUnprocessedWebhooks(ctx context.Context, limit int) int {
	return gateway.ProcessDueWebhooks(ctx, limit)
}

func (gateway *PaymentGateway) RunWebhookWorkerUntilContextDone(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for gateway.ProcessDueWebhooks(ctx, 50) == 50 && ctx.Err() == nil {
			}
		}
	}
}
