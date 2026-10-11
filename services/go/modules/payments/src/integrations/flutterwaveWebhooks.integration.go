package integrations

import (
	"bytes"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"zudomart/modules/payments/src/interfaces"
)

const FlutterwaveSignatureHeader = "Verif-Hash"

func (provider *FlutterwaveProvider) VerifyWebhookSignatureAndParse(rawBody []byte, headers http.Header) (interfaces.WebhookNotification, error) {
	expected := provider.settings.WebhookHash
	if len(expected) < 16 {
		return interfaces.WebhookNotification{}, interfaces.ErrProviderNotConfigured
	}
	presented := strings.TrimSpace(headers.Get(FlutterwaveSignatureHeader))
	expectedDigest, presentedDigest := sha256.Sum256([]byte(expected)), sha256.Sum256([]byte(presented))
	if presented == "" || subtle.ConstantTimeCompare(expectedDigest[:], presentedDigest[:]) != 1 {
		return interfaces.WebhookNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	return parseFlutterwaveWebhook(rawBody)
}

func (provider *FlutterwaveProvider) ParseVerifiedWebhookPayload(rawBody []byte) (interfaces.WebhookNotification, error) {
	return parseFlutterwaveWebhook(rawBody)
}

type flutterwaveWebhookData struct {
	Id             json.Number     `json:"id"`
	TxRef          string          `json:"tx_ref"`
	FlwRef         string          `json:"flw_ref"`
	Reference      string          `json:"reference"`
	Amount         json.RawMessage `json:"amount"`
	Currency       string          `json:"currency"`
	DebitCurrency  string          `json:"debit_currency"`
	Status         string          `json:"status"`
	Narration      string          `json:"narration"`
	AccountNumber  string          `json:"account_number"`
	TransactionId  json.Number     `json:"transaction_id"`
	CompleteReason string          `json:"complete_message"`
}

type flutterwaveRefundHook struct {
	Id             json.Number     `json:"id"`
	AmountRefunded json.RawMessage `json:"AmountRefunded"`
	Status         string          `json:"status"`
	FlwRef         string          `json:"FlwRef"`
	TransactionId  json.Number     `json:"TransactionId"`
}

func parseFlutterwaveWebhook(rawBody []byte) (interfaces.WebhookNotification, error) {
	var envelope struct {
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(rawBody, &envelope); err != nil {
		return interfaces.WebhookNotification{}, interfaces.ErrMalformedWebhookPayload
	}
	if envelope.Event == "" {
		return parseFlutterwaveRefundHook(rawBody)
	}
	var data flutterwaveWebhookData
	decoder := json.NewDecoder(bytes.NewReader(envelope.Data))
	decoder.UseNumber()
	if err := decoder.Decode(&data); err != nil {
		return interfaces.WebhookNotification{}, interfaces.ErrMalformedWebhookPayload
	}
	currency := strings.ToUpper(data.Currency)
	amount, _ := flutterwaveAmountMinor(data.Amount, currency)
	notification := interfaces.WebhookNotification{EventType: envelope.Event, Kind: interfaces.WebhookKindOther, Status: strings.ToLower(data.Status), AmountMinor: amount, Currency: currency}
	objectId := data.Id.String()
	switch {
	case envelope.Event == "charge.completed":
		notification.Kind, notification.Reference, notification.ProviderChargeId = interfaces.WebhookKindCharge, data.TxRef, data.Id.String()
	case envelope.Event == "transfer.completed" && isFlutterwaveWalletFunding(data):
		notification.Kind, notification.Reference, notification.AccountNumber = interfaces.WebhookKindWalletFunding, data.Reference, data.AccountNumber
		notification.EventType, objectId = "psa.funding", data.Reference
	case strings.HasPrefix(envelope.Event, "transfer."):
		notification.Kind, notification.Reference, notification.ProviderObjectId = interfaces.WebhookKindTransfer, data.Reference, data.Id.String()
		notification.FailureReason = truncate(data.CompleteReason, 200)
		objectId = firstNonEmptyString(data.Reference, objectId)
	case envelope.Event == "bvn.completed":
		notification.Kind, notification.Reference = interfaces.WebhookKindBvnConsent, firstNonEmptyString(data.Reference, data.FlwRef)
		objectId = notification.Reference
	case strings.HasPrefix(envelope.Event, "chargeback."):
		dispute := interfaces.ProviderDispute{
			ProviderDisputeId: data.Id.String(), ProviderChargeId: data.TransactionId.String(), ChargeReference: data.TxRef, AmountMinor: amount,
			Currency: currency, Status: FlutterwaveChargebackOutcome(strings.TrimPrefix(envelope.Event, "chargeback.")),
		}
		notification.Kind, notification.Dispute, notification.ProviderObjectId = interfaces.WebhookKindDispute, &dispute, dispute.ProviderDisputeId
		notification.Reference, notification.ProviderChargeId = data.TxRef, dispute.ProviderChargeId
	default:
		digest := sha256.Sum256(rawBody)
		objectId = hex.EncodeToString(digest[:12])
	}
	if objectId == "" {
		return interfaces.WebhookNotification{}, interfaces.ErrMalformedWebhookPayload
	}
	notification.EventKey = truncate(notification.EventType+":"+objectId+":"+notification.Status, 255)
	return notification, nil
}

func isFlutterwaveWalletFunding(data flutterwaveWebhookData) bool {
	return strings.EqualFold(data.DebitCurrency, "PSA") || strings.EqualFold(data.Narration, "WALLET FUNDING") || strings.HasPrefix(data.Reference, "PSA_")
}

func parseFlutterwaveRefundHook(rawBody []byte) (interfaces.WebhookNotification, error) {
	var refund flutterwaveRefundHook
	decoder := json.NewDecoder(bytes.NewReader(rawBody))
	decoder.UseNumber()
	if err := decoder.Decode(&refund); err != nil || refund.Id.String() == "" {
		return interfaces.WebhookNotification{}, interfaces.ErrMalformedWebhookPayload
	}
	status := strings.ToLower(refund.Status)
	return interfaces.WebhookNotification{
		EventKey: truncate("refund:"+refund.Id.String()+":"+status, 255), EventType: "refund." + status, Kind: interfaces.WebhookKindRefund,
		ProviderObjectId: refund.Id.String(), ProviderChargeId: refund.TransactionId.String(), Status: status,
	}, nil
}
