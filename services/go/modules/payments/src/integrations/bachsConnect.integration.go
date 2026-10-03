package integrations

import (
	"net/http"
	"slices"
	"strings"
	"time"

	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/utils"
)

const BachsProviderName = "bachs"

type BachsConnectSettings struct {
	BaseUrl                  string
	SecretKey                string
	WebhookSigningSecrets    []string
	WebhookTolerance         time.Duration
	SupportedCurrencies      []string
	PayoutFeeMinorByCurrency map[string]int64
	PayoutFeeRules           map[string]PayoutFeeRule
	RequestTimeout           time.Duration
	MaximumAttempts          int
	RetryBaseDelay           time.Duration
}

type BachsConnectProvider struct {
	http     bachsConnectHttpClient
	settings BachsConnectSettings
	Now      func() time.Time
}

var _ interfaces.ConnectProvider = (*BachsConnectProvider)(nil)

func NewBachsConnectProvider(settings BachsConnectSettings) *BachsConnectProvider {
	if settings.BaseUrl == "" {
		settings.BaseUrl = "https://sandbox-api.bachs.io"
	}
	if settings.WebhookTolerance <= 0 {
		settings.WebhookTolerance = 300 * time.Second
	}
	if settings.RequestTimeout <= 0 {
		settings.RequestTimeout = 15 * time.Second
	}
	if len(settings.SupportedCurrencies) == 0 {
		settings.SupportedCurrencies = []string{"NGN", "USD"}
	}
	return &BachsConnectProvider{
		settings: settings, Now: time.Now,
		http: bachsConnectHttpClient{
			baseUrl: strings.TrimRight(settings.BaseUrl, "/"), secretKey: settings.SecretKey,
			client: &http.Client{Timeout: settings.RequestTimeout}, maximumAttempts: max(settings.MaximumAttempts, 1), retryBaseDelay: settings.RetryBaseDelay,
		},
	}
}

func (provider *BachsConnectProvider) Name() string { return BachsProviderName }

func (provider *BachsConnectProvider) SupportsCurrency(currency string) bool {
	return slices.Contains(provider.settings.SupportedCurrencies, currency)
}

func decimalAmount(amountMinor int64, currency string) (string, error) {
	formatted, err := utils.FormatMinorUnitsAsMajorDecimal(amountMinor, currency)
	return string(formatted), err
}

func minorAmount(raw *string, currency string) int64 {
	if raw == nil || *raw == "" {
		return 0
	}
	amount, err := utils.ParseMajorDecimalToMinorUnits(*raw, currency)
	if err != nil {
		return 0
	}
	return amount
}

func optionalTime(raw *string) *time.Time {
	if raw == nil || *raw == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339Nano, *raw)
	if err != nil {
		return nil
	}
	return &parsed
}
