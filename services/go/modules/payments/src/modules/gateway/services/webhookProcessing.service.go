package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/webhookevent"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/utils"
	"zudomart/platform/httpserver"
)

var (
	ErrInvalidWebhookSignature = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_WEBHOOK_SIGNATURE", "Invalid webhook signature.")
	ErrMalformedWebhook        = httpserver.NewApiError(http.StatusBadRequest, "MALFORMED_WEBHOOK", "The webhook payload could not be read.")
)

type WebhookReceipt struct {
	Received  bool `json:"received"`
	Duplicate bool `json:"duplicate"`
}

func (gateway *PaymentGateway) HandleProviderWebhook(ctx context.Context, providerName string, rawBody []byte, headers http.Header) (WebhookReceipt, error) {
	provider, found := gateway.Container.Providers[providerName]
	if !found {
		return WebhookReceipt{}, httpserver.ErrNotFound
	}
	notification, err := provider.VerifyWebhookSignatureAndParse(rawBody, headers)
	switch {
	case errors.Is(err, interfaces.ErrMalformedWebhookPayload):
		return WebhookReceipt{}, ErrMalformedWebhook
	case err != nil:
		return WebhookReceipt{}, ErrInvalidWebhookSignature
	}
	digest := sha256.Sum256(rawBody)
	var claimed bool
	err = databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var claimError error
		claimed, claimError = gateway.claimWebhookEventInTransaction(ctx, gateway.Container.Client(transaction), providerName, notification.EventKey, notification.EventType, notification.Reference, digest[:], utils.RedactReusableCardSecrets(rawBody))
		return claimError
	})
	if err != nil {
		return WebhookReceipt{}, err
	}
	if !claimed {
		return WebhookReceipt{Received: true, Duplicate: true}, nil
	}
	if gateway.Container.Settings.ProcessWebhooksInBackground {
		go gateway.processAndRecordWebhook(context.WithoutCancel(ctx), providerName, notification)
		return WebhookReceipt{Received: true}, nil
	}
	processingError := gateway.processVerifiedWebhook(ctx, notification)
	if recordError := gateway.recordWebhookProcessing(ctx, providerName, notification.EventKey, processingError); recordError != nil {
		return WebhookReceipt{}, errors.Join(processingError, recordError)
	}
	if processingError != nil {
		return WebhookReceipt{}, processingError
	}
	return WebhookReceipt{Received: true}, nil
}

func (gateway *PaymentGateway) processVerifiedWebhook(ctx context.Context, notification interfaces.WebhookNotification) error {
	switch notification.Kind {
	case interfaces.WebhookKindCharge, interfaces.WebhookKindChargeRejected:
		return gateway.settleFromChargeNotification(ctx, notification)
	case interfaces.WebhookKindRefund:
		return gateway.HandleRefundNotification(ctx, notification)
	case interfaces.WebhookKindTransfer:
		return gateway.HandleTransferNotification(ctx, notification)
	case interfaces.WebhookKindDispute:
		return gateway.HandleProviderDisputeNotification(ctx, notification)
	case interfaces.WebhookKindSubscription, interfaces.WebhookKindInvoice:
		return gateway.HandleSubscriptionNotification(ctx, notification)
	case interfaces.WebhookKindIdentification:
		return gateway.HandleCustomerIdentificationNotification(ctx, notification)
	}
	return nil
}

func (gateway *PaymentGateway) settleFromChargeNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	if !hasOwnPaymentReferencePrefix(notification.Reference) {
		if notification.Subscription == nil && notification.Kind == interfaces.WebhookKindCharge {
			return gateway.HandleSubscriptionChargeNotification(ctx, notification)
		}
		return nil
	}
	_, err := gateway.verifyAndSettlePaymentIntent(ctx, notification.Reference, notification.ProviderChargeId)
	if errors.Is(err, ErrPaymentNotFound) || errors.Is(err, ErrPaymentAmountMismatch) {
		return nil
	}
	return err
}

func hasOwnPaymentReferencePrefix(reference string) bool {
	for _, prefix := range constants.ReferencePrefixByPurpose {
		if strings.HasPrefix(reference, prefix) {
			return true
		}
	}
	return false
}

func (gateway *PaymentGateway) claimWebhookEventInTransaction(ctx context.Context, client *ent.Client, provider, eventKey, eventType, reference string, digest, rawBody []byte) (bool, error) {
	create := client.WebhookEvent.Create()
	if rawBody != nil {
		create.SetRawPayload(rawBody)
	}
	err := create.
		SetProvider(provider).SetEventKey(truncate(eventKey, 255)).SetEventType(truncate(eventType, 120)).SetReference(truncate(reference, 255)).
		SetPayloadSha256(hex.EncodeToString(digest)).SetCreatedAt(gateway.Container.Now()).
		OnConflictColumns(webhookevent.FieldProvider, webhookevent.FieldEventKey).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}
	existing, err := client.WebhookEvent.Query().Where(webhookevent.Provider(provider), webhookevent.EventKey(truncate(eventKey, 255))).ForUpdate().Only(ctx)
	if err != nil {
		return false, err
	}
	return existing.ProcessedAt == nil, nil
}

func (gateway *PaymentGateway) recordWebhookProcessing(ctx context.Context, provider, eventKey string, processingError error) error {
	update := gateway.Container.Client(gateway.Container.Resources.Database).WebhookEvent.Update().
		Where(webhookevent.Provider(provider), webhookevent.EventKey(truncate(eventKey, 255))).AddAttemptCount(1)
	if processingError != nil {
		return update.SetLastError(truncate(processingError.Error(), 1000)).Exec(ctx)
	}
	return update.SetProcessedAt(gateway.Container.Now().UTC()).SetLastError("").Exec(ctx)
}

func truncate(value string, maximum int) string {
	if len(value) <= maximum {
		return value
	}
	return value[:maximum]
}

func (gateway *PaymentGateway) processAndRecordWebhook(ctx context.Context, providerName string, notification interfaces.WebhookNotification) {
	processingError := gateway.processVerifiedWebhook(ctx, notification)
	if err := gateway.recordWebhookProcessing(ctx, providerName, notification.EventKey, processingError); err != nil || processingError != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "webhook processing failed; the sweeper retries it", "eventKey", notification.EventKey, "error", errors.Join(processingError, err))
	}
}

func (gateway *PaymentGateway) RetryUnprocessedWebhooks(ctx context.Context, limit int) int {
	pending, err := gateway.Container.Client(gateway.Container.Resources.Database).WebhookEvent.Query().
		Where(webhookevent.ProcessedAtIsNil(), webhookevent.RawPayloadNotNil(), webhookevent.AttemptCountLT(20), webhookevent.CreatedAtLT(gateway.Container.Now().Add(-time.Minute))).
		Order(ent.Asc(webhookevent.FieldCreatedAt)).Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	retried := 0
	for _, event := range pending {
		provider, found := gateway.Container.Providers[event.Provider]
		if !found || event.RawPayload == nil {
			continue
		}
		notification, err := provider.ParseVerifiedWebhookPayload(*event.RawPayload)
		if err != nil {
			continue
		}
		gateway.processAndRecordWebhook(ctx, event.Provider, notification)
		retried++
	}
	return retried
}
