package kwikpik

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"nantty/modules/orders/src/logistics"
)

const (
	ProviderName          = "kwikpik"
	DefaultBaseURL        = "https://logistics-api.kwikpik.io"
	StagingBaseURL        = "https://logistics-sandbox.kwikpik.io"
	DefaultWebhookMaxSkew = 5 * time.Minute
)

var (
	ErrConfigInvalid       = errors.New("kwikpik provider configuration is invalid")
	ErrWebhookUnauthorized = errors.New("kwikpik webhook signature is invalid")
	ErrCurrencyMismatch    = errors.New("kwikpik response currency does not match request")
)

type Paths struct {
	EstimateOrder     string
	BulkOrdersUnified string
	TrackPackage      string
	CancelOrder       string
	Locations         string
	ShippingLabel     string
}

type Config struct {
	BaseUrl          string
	ApiKey           string
	WebhookSecret    string
	ContactEmail     string
	WebhookMaxSkew   time.Duration
	Paths            Paths
	AllowInsecureDev bool
	HTTPClient       *http.Client
	Now              func() time.Time
}

type Provider struct {
	baseUrl        string
	apiKey         string
	webhookSecret  string
	contactEmail   string
	webhookMaxSkew time.Duration
	paths          Paths
	client         *http.Client
	now            func() time.Time
}

func NewProvider(cfg Config) (*Provider, error) {
	parsed, err := url.Parse(strings.TrimRight(strings.TrimSpace(cfg.BaseUrl), "/"))
	if err != nil || parsed.Host == "" {
		return nil, ErrConfigInvalid
	}
	if parsed.Scheme != "https" && !(cfg.AllowInsecureDev && parsed.Scheme == "http") {
		return nil, ErrConfigInvalid
	}
	if strings.TrimSpace(cfg.ApiKey) == "" || strings.TrimSpace(cfg.ContactEmail) == "" {
		return nil, ErrConfigInvalid
	}
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	maxSkew := cfg.WebhookMaxSkew
	if maxSkew <= 0 {
		maxSkew = DefaultWebhookMaxSkew
	}
	nowFn := cfg.Now
	if nowFn == nil {
		nowFn = time.Now
	}
	return &Provider{
		baseUrl:        parsed.String(),
		apiKey:         strings.TrimSpace(cfg.ApiKey),
		webhookSecret:  strings.TrimSpace(cfg.WebhookSecret),
		contactEmail:   strings.TrimSpace(cfg.ContactEmail),
		webhookMaxSkew: maxSkew,
		paths:          mergePaths(cfg.Paths),
		client:         client,
		now:            nowFn,
	}, nil
}

func (provider *Provider) Name() string { return ProviderName }

func (provider *Provider) Quote(ctx context.Context, request logistics.QuoteRequest) ([]logistics.Quote, error) {
	pkg := map[string]any{
		"deliveryAddress":   formatAddress(request.Destination, 300),
		"packageWeightInKg": gramsToKg(request.Parcel.WeightGrams),
		"isInsured":         false,
	}
	if area := strings.TrimSpace(request.Destination.City); area != "" {
		pkg["destinationArea"] = truncateRunes(area, 120)
	}
	if request.Parcel.DeclaredValueMinor > 0 {
		pkg["packageValue"] = minorToMajor(request.Parcel.DeclaredValueMinor)
	}
	payload := map[string]any{
		"packages":      []map[string]any{pkg},
		"pickupAddress": formatAddress(request.Pickup, 300),
		"isInsured":     false,
	}
	if vehicle := normalizeVehicleType(request.VehicleType); vehicle != "" {
		payload["vehicleType"] = vehicle
	}
	var resp struct {
		Packages []struct {
			EstimatedPrice   decimalAmount `json:"estimatedPrice"`
			InsurancePremium decimalAmount `json:"insurancePremium"`
			Currency         string        `json:"currency"`
		} `json:"packages"`
		TotalEstimatedPrice   decimalAmount `json:"totalEstimatedPrice"`
		TotalInsurancePremium decimalAmount `json:"totalInsurancePremium"`
		Currency              string        `json:"currency"`
	}
	if err := provider.doJSON(ctx, http.MethodPost, provider.paths.EstimateOrder, payload, &resp); err != nil {
		return nil, err
	}
	currency := firstNonEmpty(strings.ToUpper(strings.TrimSpace(resp.Currency)), strings.ToUpper(strings.TrimSpace(request.Currency)))
	if request.Currency != "" && resp.Currency != "" && !strings.EqualFold(request.Currency, resp.Currency) {
		return nil, ErrCurrencyMismatch
	}
	amountMinor, err := resp.TotalEstimatedPrice.toMinor()
	if err != nil {
		return nil, fmt.Errorf("invalid kwikpik totalEstimatedPrice: %w", err)
	}
	if resp.TotalEstimatedPrice.raw == "" || amountMinor <= 0 {
		return nil, errors.New("kwikpik quote must include a positive totalEstimatedPrice")
	}
	insuranceMinor, err := resp.TotalInsurancePremium.toMinor()
	if err != nil {
		return nil, fmt.Errorf("invalid kwikpik totalInsurancePremium: %w", err)
	}
	if insuranceMinor != 0 {
		return nil, errors.New("kwikpik quote includes unsupported insurance")
	}
	for _, pkg := range resp.Packages {
		premium, err := pkg.InsurancePremium.toMinor()
		if err != nil || premium != 0 {
			return nil, errors.New("kwikpik package includes invalid or unsupported insurance")
		}
	}
	now := provider.now().UTC()
	return []logistics.Quote{{
		Provider: ProviderName, ProviderQuoteId: "kpv2-" + strconv.FormatInt(now.UnixNano(), 36),
		ServiceType: logistics.ServiceTypeDoorToDoor, VehicleType: normalizeVehicleType(request.VehicleType),
		AmountMinor: amountMinor, InsurancePremiumMinor: insuranceMinor, Currency: currency,
		ExpiresAt: now.Add(15 * time.Minute), Metadata: map[string]any{"apiVersion": "v2"},
	}}, nil
}

func (provider *Provider) Book(ctx context.Context, request logistics.BookRequest) (logistics.Booking, error) {
	order := provider.buildUnifiedOrder(request)
	var resp struct {
		Successful []struct {
			Id                  string        `json:"id"`
			OrderRef            string        `json:"orderRef"`
			OrderCode           string        `json:"orderCode"`
			TotalEstimatedPrice decimalAmount `json:"totalEstimatedPrice"`
			Currency            string        `json:"currency"`
			PackageInformation  struct {
				TrackingId            string `json:"trackingId"`
				MerchantPackageNumber string `json:"merchantPackageNumber"`
				Status                string `json:"status"`
			} `json:"packageInformation"`
		} `json:"successful"`
		Failed []struct {
			MerchantPackageNumber string `json:"merchantPackageNumber"`
			Error                 string `json:"error"`
		} `json:"failed"`
	}
	if err := provider.doJSON(ctx, http.MethodPost, provider.paths.BulkOrdersUnified, map[string]any{"orders": []map[string]any{order}}, &resp); err != nil {
		return logistics.Booking{}, err
	}
	if len(resp.Successful) == 0 {
		reason := "order creation rejected"
		if len(resp.Failed) > 0 && resp.Failed[0].Error != "" {
			reason = resp.Failed[0].Error
		}
		return logistics.Booking{}, fmt.Errorf("kwikpik booking failed: %s", reason)
	}
	item := resp.Successful[0]
	return logistics.Booking{
		Provider:          ProviderName,
		ProviderReference: firstNonEmpty(item.OrderCode, item.Id, item.OrderRef, request.Reference),
		Status:            normalizeV2Status(item.PackageInformation.Status, ""),
		TrackingNumber:    item.PackageInformation.TrackingId,
		Metadata: map[string]any{
			"apiVersion": "v2", "orderId": item.Id, "orderCode": item.OrderCode,
			"orderRef": item.OrderRef, "merchantPackageNumber": item.PackageInformation.MerchantPackageNumber,
		},
	}, nil
}

func (provider *Provider) Cancel(ctx context.Context, request logistics.CancelRequest) error {
	path := fmt.Sprintf(provider.paths.CancelOrder, url.PathEscape(request.ProviderReference))
	return provider.doJSON(ctx, http.MethodPatch, path, map[string]any{"reason": request.Reason}, nil)
}

func (provider *Provider) Track(ctx context.Context, request logistics.TrackRequest) (logistics.Tracking, error) {
	trackingID := strings.TrimSpace(request.TrackingNumber)
	if trackingID == "" {
		return logistics.Tracking{}, errors.New("kwikpik tracking number is required")
	}
	path := fmt.Sprintf(provider.paths.TrackPackage, url.PathEscape(trackingID))
	var resp struct {
		OrderId       string `json:"orderId"`
		TrackingId    string `json:"trackingId"`
		OrderCode     string `json:"orderCode"`
		Status        string `json:"status"`
		StatusHistory []struct {
			Status      string `json:"status"`
			StatusCode  string `json:"statusCode"`
			Description string `json:"description"`
			Address     string `json:"address"`
			CreatedAt   string `json:"createdAt"`
		} `json:"statusHistory"`
	}
	if err := provider.doJSON(ctx, http.MethodGet, path, nil, &resp); err != nil {
		return logistics.Tracking{}, err
	}
	events := make([]logistics.TrackingEvent, 0, len(resp.StatusHistory))
	for _, ev := range resp.StatusHistory {
		occurredAt, err := time.Parse(time.RFC3339, ev.CreatedAt)
		if err != nil {
			occurredAt = provider.now().UTC()
		}
		events = append(events, logistics.TrackingEvent{
			ProviderEventId: ev.Status + ":" + ev.StatusCode + ":" + ev.CreatedAt,
			Status:          normalizeV2Status(ev.Status, ev.StatusCode),
			OccurredAt:      occurredAt,
			Payload:         map[string]any{"statusCode": ev.StatusCode, "description": ev.Description, "address": ev.Address},
		})
	}
	return logistics.Tracking{
		ProviderReference: firstNonEmpty(resp.OrderCode, resp.OrderId, request.ProviderReference),
		Status:            normalizeV2Status(resp.Status, ""),
		TrackingNumber:    firstNonEmpty(resp.TrackingId, trackingID),
		Events:            events,
	}, nil
}

func (provider *Provider) Coverage(ctx context.Context) ([]logistics.Coverage, error) {
	var resp struct {
		Locations []struct {
			Id      string `json:"id"`
			Name    string `json:"name"`
			Code    string `json:"code"`
			City    string `json:"city"`
			State   string `json:"state"`
			Country string `json:"country"`
		} `json:"locations"`
	}
	if err := provider.doJSON(ctx, http.MethodGet, provider.paths.Locations, nil, &resp); err != nil {
		return nil, err
	}
	out := make([]logistics.Coverage, 0, len(resp.Locations))
	for _, loc := range resp.Locations {
		out = append(out, logistics.Coverage{
			CountryCode: normalizeCountryCode(loc.Country), RegionName: loc.State, CityName: loc.City,
			DoorToDoor: true, Metadata: map[string]any{"locationId": loc.Id, "code": loc.Code, "name": loc.Name},
		})
	}
	return out, nil
}
