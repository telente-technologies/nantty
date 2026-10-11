package integrations

import (
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"time"

	"zudomart/modules/payments/src/integrations/providerHttp"
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

var (
	_ interfaces.PaymentProvider           = (*PaystackProvider)(nil)
	_ interfaces.PayoutProvider            = (*PaystackProvider)(nil)
	_ interfaces.IdentityVerifier          = (*PaystackProvider)(nil)
	_ interfaces.PayeeProvider             = (*PaystackProvider)(nil)
	_ interfaces.DisputeProvider           = (*PaystackProvider)(nil)
	_ interfaces.SubscriptionProvider      = (*PaystackProvider)(nil)
	_ interfaces.SavedCardProvider         = (*PaystackProvider)(nil)
	_ interfaces.RefundBankDetailsProvider = (*PaystackProvider)(nil)
	_ interfaces.RefundLookupProvider      = (*PaystackProvider)(nil)
)

func NewPaystackProvider(settings PaystackSettings) *PaystackProvider {
	if settings.BaseUrl == "" {
		settings.BaseUrl = "https://api.paystack.co"
	}
	if settings.RequestTimeout <= 0 {
		settings.RequestTimeout = 15 * time.Second
	}
	if len(settings.SupportedCurrencies) == 0 {
		settings.SupportedCurrencies = []string{"NGN", "USD"}
	}
	if len(settings.Channels) == 0 {
		settings.Channels = []string{"card", "bank", "ussd", "bank_transfer"}
	}
	if len(settings.TransferFeeBands) == 0 {
		settings.TransferFeeBands = DefaultPaystackTransferFeeBands()
	}
	return &PaystackProvider{
		settings: settings, Now: time.Now,
		http: paystackHttpClient{secretKey: settings.SecretKey, transport: &providerhttp.Client{
			Provider: PaystackProviderName, BaseUrl: strings.TrimRight(settings.BaseUrl, "/"), HttpClient: &http.Client{Timeout: settings.RequestTimeout},
			ReadAttempts: max(settings.MaximumAttempts, 1), RetryBaseDelay: settings.RetryBaseDelay, Breaker: providerhttp.NewBreaker(),
			Authorize: func(request *http.Request) { request.Header.Set("Authorization", "Bearer "+settings.SecretKey) },
		}},
	}
}

func (provider *PaystackProvider) Name() string { return PaystackProviderName }

func (provider *PaystackProvider) SupportsCurrency(currency string) bool {
	return slices.Contains(provider.settings.SupportedCurrencies, currency)
}

func numberValue(value json.Number) int64 {
	if parsed, err := value.Int64(); err == nil {
		return parsed
	}
	whole, fraction, _ := strings.Cut(value.String(), ".")
	if strings.Trim(fraction, "0") != "" {
		return 0
	}
	parsed, err := json.Number(whole).Int64()
	if err != nil {
		return 0
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
