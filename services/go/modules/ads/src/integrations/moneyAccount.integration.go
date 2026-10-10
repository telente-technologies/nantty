package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/interfaces"
)

type HttpMoneyAccountGateway struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

func (gateway HttpMoneyAccountGateway) ReadVerificationLevel(ctx context.Context, userId string) (interfaces.VerificationStatus, error) {
	var view struct {
		Level    *int    `json:"level"`
		NextStep *string `json:"nextStep"`
	}
	if err := gateway.send(ctx, http.MethodGet, "/api/v1/internal/users/"+url.PathEscape(userId)+"/verification-level", "", nil, &view); err != nil {
		return interfaces.VerificationStatus{}, err
	}
	if view.Level == nil {
		return interfaces.VerificationStatus{}, adserrors.VerificationUnavailable
	}
	status := interfaces.VerificationStatus{Level: *view.Level}
	if view.NextStep != nil {
		status.NextStep = *view.NextStep
	}
	return status, nil
}

func (gateway HttpMoneyAccountGateway) IsPremium(ctx context.Context, userId string) (bool, error) {
	var entitlements struct {
		Premium *bool `json:"premium"`
	}
	if err := gateway.send(ctx, http.MethodGet, "/api/v1/internal/entitlements/"+url.PathEscape(userId), "", nil, &entitlements); err != nil {
		return false, err
	}
	if entitlements.Premium == nil {
		return false, adserrors.UpstreamUnavailable
	}
	return *entitlements.Premium, nil
}

func (gateway HttpMoneyAccountGateway) FundAdAccountFromEarnings(ctx context.Context, userId, adAccountId, currency string, amountMinor int64, idempotencyKey string) (interfaces.EarningsFundingResult, error) {
	var funded struct {
		FundingId string `json:"fundingId"`
		Amount    struct {
			AmountMinor int64  `json:"amountMinor"`
			Currency    string `json:"currency"`
		} `json:"amount"`
	}
	body := map[string]any{"userId": userId, "amount": map[string]any{"amountMinor": amountMinor, "currency": currency}}
	if err := gateway.send(ctx, http.MethodPost, "/api/v1/internal/ads/accounts/"+url.PathEscape(adAccountId)+"/earnings-fundings", idempotencyKey, body, &funded); err != nil {
		return interfaces.EarningsFundingResult{}, err
	}
	if funded.FundingId == "" {
		return interfaces.EarningsFundingResult{}, adserrors.UpstreamUnavailable
	}
	return interfaces.EarningsFundingResult{FundingId: funded.FundingId, AmountMinor: funded.Amount.AmountMinor, Currency: funded.Amount.Currency}, nil
}

func (gateway HttpMoneyAccountGateway) send(ctx context.Context, method, path, idempotencyKey string, body, destination any) error {
	reader := bytes.NewReader(nil)
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(gateway.BaseUrl, "/")+path, reader)
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Internal-Token", gateway.Token)
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	response, err := gateway.Http.Do(request)
	if err != nil {
		return adserrors.UpstreamUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		if json.NewDecoder(response.Body).Decode(destination) != nil {
			return adserrors.UpstreamUnavailable
		}
		return nil
	}
	return translateMoneyAccountFailure(response)
}

func translateMoneyAccountFailure(response *http.Response) error {
	var failure struct {
		Code string `json:"code"`
	}
	_ = json.NewDecoder(response.Body).Decode(&failure)
	switch failure.Code {
	case "VERIFICATION_REQUIRED":
		return adserrors.VerificationRequired
	case "VERIFICATION_UNAVAILABLE":
		return adserrors.VerificationUnavailable
	case "INSUFFICIENT_FUNDS":
		return adserrors.InsufficientEarnings
	case "IDEMPOTENCY_KEY_REUSED":
		return adserrors.IdempotencyKeyReused
	}
	return adserrors.UpstreamUnavailable
}

type StaticVerificationReader struct{ Level int }

func (reader StaticVerificationReader) ReadVerificationLevel(context.Context, string) (interfaces.VerificationStatus, error) {
	return interfaces.VerificationStatus{Level: reader.Level}, nil
}

type UnconfiguredMoneyAccountGateway struct{}

func (UnconfiguredMoneyAccountGateway) ReadVerificationLevel(context.Context, string) (interfaces.VerificationStatus, error) {
	return interfaces.VerificationStatus{}, adserrors.VerificationUnavailable
}

func (UnconfiguredMoneyAccountGateway) IsPremium(context.Context, string) (bool, error) {
	return false, adserrors.UpstreamUnavailable
}

func (UnconfiguredMoneyAccountGateway) FundAdAccountFromEarnings(context.Context, string, string, string, int64, string) (interfaces.EarningsFundingResult, error) {
	return interfaces.EarningsFundingResult{}, adserrors.UpstreamUnavailable
}

type StaticEntitlementReader struct{ Premium map[string]bool }

func (reader StaticEntitlementReader) IsPremium(_ context.Context, userId string) (bool, error) {
	return reader.Premium[userId], nil
}
