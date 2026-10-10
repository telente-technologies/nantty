package integrations

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"zudomart/modules/payments/src/interfaces"
)

const PaystackSignatureHeader = "X-Paystack-Signature"

func SignPaystackWebhookPayload(secretKey string, rawBody []byte) string {
	mac := hmac.New(sha512.New, []byte(secretKey))
	mac.Write(rawBody)
	return hex.EncodeToString(mac.Sum(nil))
}

func (provider *PaystackProvider) VerifyWebhookSignatureAndParse(rawBody []byte, headers http.Header) (interfaces.WebhookNotification, error) {
	if provider.settings.SecretKey == "" {
		return interfaces.WebhookNotification{}, interfaces.ErrProviderNotConfigured
	}
	presented := []byte(strings.ToLower(strings.TrimSpace(headers.Get(PaystackSignatureHeader))))
	if len(presented) == 0 {
		return interfaces.WebhookNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	matched := false
	for _, key := range []string{provider.settings.SecretKey, provider.settings.PreviousSecretKey} {
		if key != "" && hmac.Equal(presented, []byte(SignPaystackWebhookPayload(key, rawBody))) {
			matched = true
		}
	}
	if !matched {
		return interfaces.WebhookNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	return parsePaystackWebhook(rawBody)
}

type paystackWebhookData struct {
	Id                   json.Number     `json:"id"`
	Status               string          `json:"status"`
	Reference            string          `json:"reference"`
	TransactionReference string          `json:"transaction_reference"`
	TransferCode         string          `json:"transfer_code"`
	SubscriptionCode     string          `json:"subscription_code"`
	EmailToken           string          `json:"email_token"`
	NextPaymentDate      *string         `json:"next_payment_date"`
	Amount               json.Number     `json:"amount"`
	Currency             string          `json:"currency"`
	GatewayResponse      string          `json:"gateway_response"`
	Reason               string          `json:"reason"`
	Paid                 bool            `json:"paid"`
	Resolution           string          `json:"resolution"`
	Plan                 json.RawMessage `json:"plan"`
	CustomerCode         string          `json:"customer_code"`
	Identification       *struct {
		AccountNumber string `json:"account_number"`
		BankCode      string `json:"bank_code"`
	} `json:"identification"`
	Customer *struct {
		CustomerCode string `json:"customer_code"`
	} `json:"customer"`
	Subscription *struct {
		SubscriptionCode string  `json:"subscription_code"`
		Status           string  `json:"status"`
		NextPaymentDate  *string `json:"next_payment_date"`
		EmailToken       string  `json:"email_token"`
	} `json:"subscription"`
	Transaction *struct {
		Id        json.Number `json:"id"`
		Reference string      `json:"reference"`
	} `json:"transaction"`
}

func parsePaystackWebhook(rawBody []byte) (interfaces.WebhookNotification, error) {
	var envelope struct {
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(rawBody, &envelope); err != nil || envelope.Event == "" {
		return interfaces.WebhookNotification{}, interfaces.ErrMalformedWebhookPayload
	}
	var data paystackWebhookData
	decoder := json.NewDecoder(bytes.NewReader(envelope.Data))
	decoder.UseNumber()
	if err := decoder.Decode(&data); err != nil {
		return interfaces.WebhookNotification{}, interfaces.ErrMalformedWebhookPayload
	}
	currency := strings.ToUpper(data.Currency)
	notification := interfaces.WebhookNotification{
		EventType: envelope.Event, Kind: classifyPaystackEvent(envelope.Event), Reference: data.Reference, Status: data.Status,
		ProviderChargeId: data.Id.String(), AmountMinor: numberValue(data.Amount), Currency: currency, FailureReason: firstNonEmptyString(data.Reason, data.GatewayResponse),
	}
	if data.Customer != nil {
		notification.ProviderCustomerId = data.Customer.CustomerCode
	}
	objectId := data.Id.String()
	switch notification.Kind {
	case interfaces.WebhookKindIdentification:
		notification.ProviderCustomerId, notification.ProviderChargeId = data.CustomerCode, ""
		objectId = data.CustomerCode
		if data.Identification != nil {
			objectId += ":" + data.Identification.BankCode + ":" + data.Identification.AccountNumber
		}
	case interfaces.WebhookKindTransfer:
		notification.ProviderObjectId, notification.ProviderChargeId = data.TransferCode, ""
		objectId = firstNonEmptyString(data.Reference, data.TransferCode)
	case interfaces.WebhookKindRefund:
		notification.ProviderObjectId, notification.Reference, notification.ProviderChargeId = data.Id.String(), data.TransactionReference, ""
	case interfaces.WebhookKindDispute:
		dispute := paystackDispute{Id: data.Id, Status: data.Status, Currency: data.Currency}
		if data.Transaction != nil {
			dispute.Transaction = &struct {
				Id        json.Number `json:"id"`
				Reference string      `json:"reference"`
				Amount    json.Number `json:"amount"`
			}{Id: data.Transaction.Id, Reference: data.Transaction.Reference}
		}
		converted := dispute.toProviderDispute()
		converted.Status = PaystackDisputeOutcome(envelope.Event, data.Status, data.Resolution)
		notification.Dispute, notification.ProviderObjectId = &converted, converted.ProviderDisputeId
		notification.Reference, notification.ProviderChargeId = converted.ChargeReference, converted.ProviderChargeId
	case interfaces.WebhookKindSubscription, interfaces.WebhookKindInvoice:
		update := &interfaces.ProviderSubscriptionUpdate{
			ProviderSubscriptionId: data.SubscriptionCode, PlanCode: planCodeFrom(data.Plan), EmailToken: data.EmailToken, Status: data.Status,
			CurrentPeriodEndsAt: optionalTime(data.NextPaymentDate), ProviderCustomerId: notification.ProviderCustomerId,
		}
		if data.Subscription != nil {
			update.ProviderSubscriptionId = firstNonEmptyString(update.ProviderSubscriptionId, data.Subscription.SubscriptionCode)
			update.EmailToken = firstNonEmptyString(update.EmailToken, data.Subscription.EmailToken)
			if update.CurrentPeriodEndsAt == nil {
				update.CurrentPeriodEndsAt = optionalTime(data.Subscription.NextPaymentDate)
			}
			if notification.Kind == interfaces.WebhookKindInvoice {
				update.Status = data.Subscription.Status
			}
		}
		notification.Subscription, notification.ProviderObjectId = update, update.ProviderSubscriptionId
		objectId = firstNonEmptyString(data.Id.String(), update.ProviderSubscriptionId)
	}
	notification.EventKey = truncate(envelope.Event+":"+objectId+":"+data.Status, 255)
	return notification, nil
}

func classifyPaystackEvent(event string) interfaces.WebhookKind {
	switch {
	case event == "charge.success":
		return interfaces.WebhookKindCharge
	case event == "bank.transfer.rejected":
		return interfaces.WebhookKindChargeRejected
	case strings.HasPrefix(event, "transfer."):
		return interfaces.WebhookKindTransfer
	case strings.HasPrefix(event, "refund."):
		return interfaces.WebhookKindRefund
	case strings.HasPrefix(event, "charge.dispute."):
		return interfaces.WebhookKindDispute
	case strings.HasPrefix(event, "subscription."):
		return interfaces.WebhookKindSubscription
	case strings.HasPrefix(event, "invoice."):
		return interfaces.WebhookKindInvoice
	case strings.HasPrefix(event, "customeridentification."):
		return interfaces.WebhookKindIdentification
	}
	return interfaces.WebhookKindOther
}

func PaystackDisputeOutcome(event, status, resolution string) string {
	if event != "charge.dispute.resolve" && status != "resolved" {
		return "open"
	}
	if resolution == "merchant-accepted" {
		return "lost"
	}
	return "won"
}

func (provider *PaystackProvider) ParseVerifiedWebhookPayload(rawBody []byte) (interfaces.WebhookNotification, error) {
	return parsePaystackWebhook(rawBody)
}
