package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/webhookevent"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/utils"
	"nantty/platform/httpserver"
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
	inserted, err := gateway.storeWebhookEvent(ctx, providerName, notification, digest[:], utils.RedactReusableCardSecrets(rawBody))
	if err != nil {
		return WebhookReceipt{}, err
	}
	if gateway.Container.Settings.ProcessWebhooksInBackground {
		return WebhookReceipt{Received: true, Duplicate: !inserted}, nil
	}
	claimed, err := gateway.claimDueWebhooks(ctx, 1, webhookevent.Provider(providerName), webhookevent.EventKey(truncate(notification.EventKey, 255)))
	if err != nil {
		return WebhookReceipt{}, err
	}
	if len(claimed) == 0 {
		return WebhookReceipt{Received: true, Duplicate: true}, nil
	}
	if err := gateway.processClaimedWebhook(ctx, claimed[0], &notification); err != nil {
		return WebhookReceipt{}, err
	}
	return WebhookReceipt{Received: true, Duplicate: !inserted}, nil
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
	case interfaces.WebhookKindWalletFunding:
		return gateway.HandleWalletFundingNotification(ctx, notification)
	case interfaces.WebhookKindBvnConsent:
		return gateway.HandleBvnConsentNotification(ctx, notification.Reference)
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
	if errors.Is(err, ErrPaymentAmountMismatch) {
		return webhookNeedsFinanceReview{cause: err}
	}
	if errors.Is(err, ErrPaymentNotFound) {
		return nil
	}
	return err
}

type webhookNeedsFinanceReview struct {
	cause error
}

func (review webhookNeedsFinanceReview) Error() string {
	return "needs finance review: " + review.cause.Error()
}

func (review webhookNeedsFinanceReview) Unwrap() error {
	return review.cause
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

func truncate(value string, maximum int) string {
	if len(value) <= maximum {
		return value
	}
	return value[:maximum]
}
