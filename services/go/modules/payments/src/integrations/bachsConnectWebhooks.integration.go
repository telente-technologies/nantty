package integrations

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

func (provider *BachsConnectProvider) VerifyWebhookSignatureAndParse(rawBody []byte, headers http.Header) (interfaces.WebhookNotification, error) {
	if len(provider.settings.WebhookSigningSecrets) == 0 {
		return interfaces.WebhookNotification{}, interfaces.ErrProviderNotConfigured
	}
	timestamp, signatures := readBachsSignatureHeaders(headers)
	if timestamp == "" || len(signatures) == 0 {
		return interfaces.WebhookNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	if !provider.signatureMatchesAnySecret(timestamp, rawBody, signatures) {
		return interfaces.WebhookNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	sentAtSeconds, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return interfaces.WebhookNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	age := provider.Now().Sub(time.Unix(sentAtSeconds, 0))
	if age > provider.settings.WebhookTolerance || age < -provider.settings.WebhookTolerance {
		return interfaces.WebhookNotification{}, interfaces.ErrStaleWebhookTimestamp
	}
	return parseBachsWebhookEnvelope(rawBody)
}

func readBachsSignatureHeaders(headers http.Header) (string, []string) {
	if versioned := strings.TrimSpace(headers.Get("X-Bachs-Signature-V2")); versioned != "" {
		timestamp, signatures := "", []string{}
		for _, part := range strings.Split(versioned, ",") {
			name, value, found := strings.Cut(strings.TrimSpace(part), "=")
			switch {
			case !found:
			case name == "t":
				timestamp = value
			case name == "v1":
				signatures = append(signatures, strings.ToLower(value))
			}
		}
		return timestamp, signatures
	}
	legacy := strings.ToLower(strings.TrimSpace(headers.Get("X-Bachs-Signature")))
	if legacy == "" {
		return strings.TrimSpace(headers.Get("X-Bachs-Timestamp")), nil
	}
	return strings.TrimSpace(headers.Get("X-Bachs-Timestamp")), []string{legacy}
}

func (provider *BachsConnectProvider) signatureMatchesAnySecret(timestamp string, rawBody []byte, signatures []string) bool {
	matched := false
	for _, secret := range provider.settings.WebhookSigningSecrets {
		expected := []byte(SignBachsWebhookPayload(secret, timestamp, rawBody))
		for _, signature := range signatures {
			if hmac.Equal(expected, []byte(signature)) {
				matched = true
			}
		}
	}
	return matched
}

func SignBachsWebhookPayload(secret, timestamp string, rawBody []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(rawBody)
	return hex.EncodeToString(mac.Sum(nil))
}

type bachsWebhookEnvelope struct {
	Id             string `json:"id"`
	Type           string `json:"type"`
	OrganizationId string `json:"organization_id"`
	Account        string `json:"account"`
	Data           struct {
		ChargeId           *string           `json:"charge_id"`
		CheckoutId         *string           `json:"checkout_id"`
		Reference          *string           `json:"reference"`
		Status             string            `json:"status"`
		RefundId           string            `json:"refund_id"`
		WithdrawalId       string            `json:"withdrawal_id"`
		TransferId         string            `json:"transfer_id"`
		DisputeId          string            `json:"dispute_id"`
		Amount             *string           `json:"amount"`
		Currency           string            `json:"currency"`
		Reason             *string           `json:"reason"`
		ResponseDeadlineAt *string           `json:"response_deadline_at"`
		Capability         string            `json:"capability"`
		SubscriptionId     string            `json:"subscription_id"`
		TrialEnd           *string           `json:"trial_end"`
		CurrentPeriodEnd   *string           `json:"current_period_end"`
		Metadata           map[string]string `json:"metadata"`
		Charge             *struct {
			Id string `json:"id"`
		} `json:"charge"`
		Customer *struct {
			CustomerId string `json:"customer_id"`
		} `json:"customer"`
		Subscription *struct {
			SubscriptionId string `json:"subscription_id"`
		} `json:"subscription"`
		PaymentMethodId string `json:"payment_method_id"`
		CardBrand       string `json:"card_brand"`
		CardLast4       string `json:"card_last4"`
		CardExpMonth    int    `json:"card_exp_month"`
		CardExpYear     int    `json:"card_exp_year"`
		Fingerprint     string `json:"fingerprint"`
		IsDefault       bool   `json:"is_default"`
		CustomerId      string `json:"customer_id"`
	} `json:"data"`
}

func parseBachsWebhookEnvelope(rawBody []byte) (interfaces.WebhookNotification, error) {
	var envelope bachsWebhookEnvelope
	decoder := json.NewDecoder(bytes.NewReader(rawBody))
	if err := decoder.Decode(&envelope); err != nil || envelope.Id == "" || envelope.Type == "" {
		return interfaces.WebhookNotification{}, interfaces.ErrMalformedWebhookPayload
	}
	data := envelope.Data
	notification := interfaces.WebhookNotification{
		EventKey: envelope.Id, EventType: envelope.Type, Kind: classifyBachsEvent(envelope.Type), ConnectedAccountId: envelope.Account,
		Reference: stringValue(data.Reference), ProviderChargeId: stringValue(data.ChargeId), ProviderCheckoutId: stringValue(data.CheckoutId),
		Status: data.Status, Capability: data.Capability,
	}
	if data.Charge != nil && notification.ProviderChargeId == "" {
		notification.ProviderChargeId = data.Charge.Id
	}
	for _, candidate := range []string{data.RefundId, data.WithdrawalId, data.TransferId, data.DisputeId, data.SubscriptionId, notification.ProviderCheckoutId} {
		if candidate != "" {
			notification.ProviderObjectId = candidate
			break
		}
	}
	currency := strings.ToUpper(data.Currency)
	notification.Currency, notification.AmountMinor = currency, minorAmount(data.Amount, currency)
	switch notification.Kind {
	case interfaces.WebhookKindPaymentMethod:
		saved := &interfaces.SavedPaymentMethod{
			PaymentMethodId: data.PaymentMethodId, ProviderCustomerId: data.CustomerId, Brand: data.CardBrand, Last4: data.CardLast4,
			ExpiryMonth: data.CardExpMonth, ExpiryYear: data.CardExpYear, ProviderFingerprint: data.Fingerprint, IsDefault: data.IsDefault,
		}
		if data.Customer != nil && saved.ProviderCustomerId == "" {
			saved.ProviderCustomerId = data.Customer.CustomerId
		}
		notification.SavedPaymentMethod = saved
		notification.ProviderObjectId = saved.ProviderCustomerId
	case interfaces.WebhookKindDispute:
		notification.Dispute = &interfaces.ProviderDispute{
			ProviderDisputeId: data.DisputeId, ProviderChargeId: notification.ProviderChargeId, ConnectedAccountId: envelope.Account,
			AmountMinor: minorAmount(data.Amount, currency), Currency: currency, Status: data.Status, Reason: stringValue(data.Reason),
			ResponseDeadlineAt: optionalTime(data.ResponseDeadlineAt),
		}
	case interfaces.WebhookKindSubscription, interfaces.WebhookKindInvoice:
		update := &interfaces.ProviderSubscriptionUpdate{ProviderSubscriptionId: data.SubscriptionId, Status: data.Status, TrialEndsAt: optionalTime(data.TrialEnd), CurrentPeriodEndsAt: optionalTime(data.CurrentPeriodEnd), Metadata: data.Metadata}
		if data.Subscription != nil {
			update.ProviderSubscriptionId = data.Subscription.SubscriptionId
		}
		if data.Customer != nil {
			update.ProviderCustomerId = data.Customer.CustomerId
		}
		notification.ProviderObjectId = update.ProviderSubscriptionId
		notification.Subscription = update
	}
	return notification, nil
}

func classifyBachsEvent(eventType string) interfaces.WebhookKind {
	prefixes := []struct {
		prefix string
		kind   interfaces.WebhookKind
	}{
		{"collection.", interfaces.WebhookKindCharge}, {"checkout.", interfaces.WebhookKindCheckout}, {"refund.", interfaces.WebhookKindRefund},
		{"payout.", interfaces.WebhookKindPayout}, {"transfer.", interfaces.WebhookKindTransfer}, {"dispute.", interfaces.WebhookKindDispute},
		{"account.", interfaces.WebhookKindAccount}, {"capability.", interfaces.WebhookKindCapability},
		{"customer.subscription.", interfaces.WebhookKindSubscription}, {"invoice.", interfaces.WebhookKindInvoice},
		{"payment_method.", interfaces.WebhookKindPaymentMethod},
	}
	for _, candidate := range prefixes {
		if strings.HasPrefix(eventType, candidate.prefix) {
			return candidate.kind
		}
	}
	return interfaces.WebhookKindOther
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
