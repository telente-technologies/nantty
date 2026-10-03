package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/generated/ent/webhookevent"
	"zudomart/modules/payments/src/interfaces"
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
		claimed, claimError = gateway.claimWebhookEventInTransaction(ctx, gateway.Container.Client(transaction), providerName, notification.EventKey, notification.EventType, notification.Reference, digest[:])
		return claimError
	})
	if err != nil {
		return WebhookReceipt{}, err
	}
	if !claimed {
		return WebhookReceipt{Received: true, Duplicate: true}, nil
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
	case interfaces.WebhookKindCharge, interfaces.WebhookKindCheckout:
		return gateway.settleFromChargeNotification(ctx, notification)
	case interfaces.WebhookKindRefund:
		return gateway.HandleRefundNotification(ctx, notification.ProviderObjectId, notification.Reference, notification.EventType)
	case interfaces.WebhookKindPayout:
		return gateway.HandlePayoutNotification(ctx, notification)
	case interfaces.WebhookKindTransfer:
		return gateway.HandleTransferNotification(ctx, notification.ProviderObjectId)
	case interfaces.WebhookKindDispute:
		return gateway.HandleProviderDisputeNotification(ctx, notification)
	case interfaces.WebhookKindAccount, interfaces.WebhookKindCapability:
		if notification.ConnectedAccountId == "" {
			return nil
		}
		return gateway.RefreshConnectedAccountFromProvider(ctx, notification.ConnectedAccountId, notification.Capability, notification.Status)
	case interfaces.WebhookKindSubscription, interfaces.WebhookKindInvoice:
		return gateway.HandleSubscriptionNotification(ctx, notification)
	}
	return nil
}

func (gateway *PaymentGateway) settleFromChargeNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	reference := notification.Reference
	if !hasOwnPaymentReferencePrefix(reference) && notification.ProviderCheckoutId != "" {
		intent, err := gateway.Container.Client(gateway.Container.Resources.Database).PaymentIntent.Query().
			Where(paymentintent.ProviderCheckoutID(notification.ProviderCheckoutId)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		reference = intent.Reference
	}
	if !hasOwnPaymentReferencePrefix(reference) {
		return nil
	}
	_, err := gateway.verifyAndSettlePaymentIntent(ctx, reference, notification.ProviderChargeId)
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

func (gateway *PaymentGateway) claimWebhookEventInTransaction(ctx context.Context, client *ent.Client, provider, eventKey, eventType, reference string, digest []byte) (bool, error) {
	err := client.WebhookEvent.Create().
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
