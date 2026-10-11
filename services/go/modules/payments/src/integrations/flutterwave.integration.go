package integrations

import (
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"zudomart/modules/payments/src/integrations/providerHttp"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/platform/money"
)

const FlutterwaveProviderName = "flutterwave"

type FlutterwaveSettings struct {
	BaseUrl             string
	SecretKey           string
	WebhookHash         string
	MerchantId          string
	MerchantCountry     string
	SupportedCurrencies []string
	PaymentOptions      map[string]string
	TransferCallbackUrl string
	RenewalRedirectUrl  string
	CheckoutTitle       string
	CheckoutLogoUrl     string
	RequestTimeout      time.Duration
	MaximumAttempts     int
	RetryBaseDelay      time.Duration
}

type FlutterwaveProvider struct {
	http     flutterwaveHttpClient
	settings FlutterwaveSettings
	Now      func() time.Time
}

var (
	_ interfaces.PaymentProvider      = (*FlutterwaveProvider)(nil)
	_ interfaces.PayoutProvider       = (*FlutterwaveProvider)(nil)
	_ interfaces.IdentityVerifier     = (*FlutterwaveProvider)(nil)
	_ interfaces.BvnConsentVerifier   = (*FlutterwaveProvider)(nil)
	_ interfaces.WalletProvider       = (*FlutterwaveProvider)(nil)
	_ interfaces.PayeeProvider        = (*FlutterwaveProvider)(nil)
	_ interfaces.DisputeProvider      = (*FlutterwaveProvider)(nil)
	_ interfaces.SavedCardProvider    = (*FlutterwaveProvider)(nil)
	_ interfaces.RefundLookupProvider = (*FlutterwaveProvider)(nil)
)

func DefaultFlutterwavePaymentOptions() map[string]string {
	return map[string]string{
		"NGN": "card,banktransfer,ussd,account,opay", "GHS": "card,mobilemoneyghana", "KES": "card,mpesa", "ZAR": "card,account",
		"UGX": "card,mobilemoneyuganda", "USD": "card",
	}
}

func NewFlutterwaveProvider(settings FlutterwaveSettings) *FlutterwaveProvider {
	if settings.BaseUrl == "" {
		settings.BaseUrl = "https://api.flutterwave.com/v3"
	}
	if settings.RequestTimeout <= 0 {
		settings.RequestTimeout = 35 * time.Second
	}
	if len(settings.SupportedCurrencies) == 0 {
		settings.SupportedCurrencies = []string{"NGN", "GHS", "KES", "ZAR", "USD"}
	}
	if len(settings.PaymentOptions) == 0 {
		settings.PaymentOptions = DefaultFlutterwavePaymentOptions()
	}
	if settings.MerchantCountry == "" {
		settings.MerchantCountry = "NG"
	}
	return &FlutterwaveProvider{
		settings: settings, Now: time.Now,
		http: flutterwaveHttpClient{secretKey: settings.SecretKey, transport: &providerhttp.Client{
			Provider: FlutterwaveProviderName, BaseUrl: strings.TrimRight(settings.BaseUrl, "/"), HttpClient: &http.Client{Timeout: settings.RequestTimeout},
			ReadAttempts: max(settings.MaximumAttempts, 1), RetryBaseDelay: settings.RetryBaseDelay, Breaker: providerhttp.NewBreaker(),
			Authorize: func(request *http.Request) { request.Header.Set("Authorization", "Bearer "+settings.SecretKey) },
		}},
	}
}

func (provider *FlutterwaveProvider) Name() string { return FlutterwaveProviderName }

func (provider *FlutterwaveProvider) SupportsCurrency(currency string) bool {
	return slices.Contains(provider.settings.SupportedCurrencies, currency)
}

func (provider *FlutterwaveProvider) MerchantId() string { return provider.settings.MerchantId }

var errFlutterwaveAmount = errors.New("flutterwave returned an amount that is not an exact decimal")

func flutterwaveAmountMinor(raw json.RawMessage, currency string) (int64, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return 0, nil
	}
	amount, err := money.ParseMajorUnitsFromJson(raw, currency)
	if err != nil {
		return 0, errors.Join(errFlutterwaveAmount, err)
	}
	return amount, nil
}

func flutterwaveFeeMinor(raw json.RawMessage, currency string) int64 {
	amount, err := flutterwaveAmountMinor(raw, currency)
	if err == nil {
		return amount
	}
	code, codeErr := money.ParseCurrencyCode(currency)
	if codeErr != nil || !errors.Is(err, money.ErrTooManyFractionDigits) {
		return 0
	}
	whole, fraction, _ := strings.Cut(strings.Trim(strings.TrimSpace(string(raw)), `"`), ".")
	kept := whole
	if exponent := money.MinorUnitExponentForCurrency(code); exponent > 0 {
		kept += "." + fraction[:exponent]
	}
	rounded, parseErr := money.ParseMajorUnits(kept, currency)
	if parseErr != nil {
		return 0
	}
	return rounded + 1
}

func majorUnits(amountMinor int64, currency string) json.Number {
	text, err := money.FormatMajorUnits(amountMinor, currency)
	if err != nil {
		return json.Number("0")
	}
	return json.Number(text)
}

func flutterwaveTime(raw string) *time.Time {
	if raw == "" {
		return nil
	}
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.000Z", "2006-01-02 15:04:05", "2006-01-02T15:04:05", "2006-01-02"} {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return &parsed
		}
	}
	return nil
}
