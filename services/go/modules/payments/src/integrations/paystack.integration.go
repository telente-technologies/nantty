package integrations

import (
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

const PaystackProviderName = "paystack"

type PaystackSettings struct {
	BaseUrl             string
	SecretKey           string
	PreviousSecretKey   string
	Channels            []string
	TransferFeeBands    []TransferFeeBand
	SupportedCurrencies []string
	RequestTimeout      time.Duration
	MaximumAttempts     int
	RetryBaseDelay      time.Duration
}

type PaystackProvider struct {
	http     paystackHttpClient
	settings PaystackSettings
	Now      func() time.Time
}

var _ interfaces.FullPaymentProvider = (*PaystackProvider)(nil)

func NewPaystackProvider(settings PaystackSettings) *PaystackProvider {
	if settings.BaseUrl == "" {
		settings.BaseUrl = "https://api.paystack.co"
	}
	if settings.RequestTimeout <= 0 {
		settings.RequestTimeout = 15 * time.Second
	}
	if len(settings.SupportedCurrencies) == 0 {
		settings.SupportedCurrencies = []string{"NGN"}
	}
	if len(settings.Channels) == 0 {
		settings.Channels = []string{"card", "bank", "ussd", "bank_transfer"}
	}
	if len(settings.TransferFeeBands) == 0 {
		settings.TransferFeeBands = DefaultPaystackTransferFeeBands()
	}
	return &PaystackProvider{
		settings: settings, Now: time.Now,
		http: paystackHttpClient{
			baseUrl: strings.TrimRight(settings.BaseUrl, "/"), secretKey: settings.SecretKey,
			client: &http.Client{Timeout: settings.RequestTimeout}, maximumAttempts: max(settings.MaximumAttempts, 1), retryBaseDelay: settings.RetryBaseDelay,
		},
	}
}

func (provider *PaystackProvider) Name() string { return PaystackProviderName }

func (provider *PaystackProvider) SupportsCurrency(currency string) bool {
	return slices.Contains(provider.settings.SupportedCurrencies, currency)
}

func numberValue(value json.Number) int64 {
	parsed, err := value.Int64()
	if err != nil {
		floating, floatErr := value.Float64()
		if floatErr != nil {
			return 0
		}
		return int64(floating)
	}
	return parsed
}

func optionalTime(raw *string) *time.Time {
	if raw == nil || *raw == "" {
		return nil
	}
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.000Z", "2006-01-02"} {
		if parsed, err := time.Parse(layout, *raw); err == nil {
			return &parsed
		}
	}
	return nil
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
