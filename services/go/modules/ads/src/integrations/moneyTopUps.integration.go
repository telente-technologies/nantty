package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/interfaces"
	"nantty/platform/httpserver"
)

type HttpMoneyTopUpGateway struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

type moneyMoney struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type moneyTopUp struct {
	Id          string     `json:"id"`
	Reference   string     `json:"reference"`
	Status      string     `json:"status"`
	Amount      moneyMoney `json:"amount"`
	CheckoutUrl *string    `json:"checkoutUrl"`
	Provider    string     `json:"provider"`
	CompletedAt *time.Time `json:"completedAt"`
}

func (gateway HttpMoneyTopUpGateway) accountPath(adAccountId string) string {
	return strings.TrimRight(gateway.BaseUrl, "/") + "/api/v1/internal/ads/accounts/" + url.PathEscape(adAccountId) + "/top-ups"
}

func (gateway HttpMoneyTopUpGateway) StartTopUp(ctx context.Context, request interfaces.TopUpStartRequest) (interfaces.StartedTopUp, error) {
	body, _ := json.Marshal(map[string]any{"userId": request.UserId, "amount": moneyMoney{AmountMinor: request.AmountMinor, Currency: request.Currency}, "returnTo": request.ReturnTo})
	outgoing, err := http.NewRequestWithContext(ctx, http.MethodPost, gateway.accountPath(request.AdAccountId), bytes.NewReader(body))
	if err != nil {
		return interfaces.StartedTopUp{}, err
	}
	outgoing.Header.Set("Idempotency-Key", request.IdempotencyKey)
	var started moneyTopUp
	if err := gateway.send(outgoing, &started); err != nil {
		return interfaces.StartedTopUp{}, err
	}
	if started.Id == "" || started.Reference == "" {
		return interfaces.StartedTopUp{}, fmt.Errorf("money returned an unreadable top-up")
	}
	result := interfaces.StartedTopUp{TopUpId: started.Id, Reference: started.Reference, Provider: started.Provider}
	if started.CheckoutUrl != nil {
		result.CheckoutUrl = *started.CheckoutUrl
	}
	return result, nil
}

func (gateway HttpMoneyTopUpGateway) ReadTopUp(ctx context.Context, adAccountId, reference string) (interfaces.TopUpStatus, error) {
	outgoing, err := http.NewRequestWithContext(ctx, http.MethodGet, gateway.accountPath(adAccountId)+"/"+url.PathEscape(reference), nil)
	if err != nil {
		return interfaces.TopUpStatus{}, err
	}
	var found moneyTopUp
	if err := gateway.send(outgoing, &found); err != nil {
		return interfaces.TopUpStatus{}, err
	}
	return interfaces.TopUpStatus{TopUpId: found.Id, Status: found.Status, AmountMinor: found.Amount.AmountMinor, Currency: found.Amount.Currency, CompletedAt: found.CompletedAt}, nil
}

func (gateway HttpMoneyTopUpGateway) send(outgoing *http.Request, destination any) error {
	outgoing.Header.Set("Content-Type", "application/json")
	outgoing.Header.Set("X-Internal-Token", gateway.Token)
	response, err := gateway.Http.Do(outgoing)
	if err != nil {
		return adserrors.TopUpsUnavailable
	}
	defer response.Body.Close()
	payload, _ := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	switch {
	case response.StatusCode == http.StatusNotFound:
		return adserrors.TopUpNotFound
	case response.StatusCode >= 500 || response.StatusCode == http.StatusUnauthorized:
		return adserrors.TopUpsUnavailable
	case response.StatusCode >= 400:
		return relayMoneyError(response.StatusCode, payload)
	}
	if err := json.Unmarshal(payload, destination); err != nil {
		return fmt.Errorf("money returned an unreadable top-up: %w", err)
	}
	return nil
}

func relayMoneyError(status int, payload []byte) error {
	var described struct {
		Code    string                       `json:"code"`
		Message string                       `json:"message"`
		Issues  []httpserver.ValidationIssue `json:"issues"`
	}
	if json.Unmarshal(payload, &described) != nil || described.Code == "" {
		return adserrors.TopUpsUnavailable
	}
	if len(described.Issues) > 0 {
		return httpserver.NewValidationFailedError(described.Issues)
	}
	return httpserver.NewApiError(status, described.Code, described.Message)
}

type UnavailableTopUpGateway struct{}

func (UnavailableTopUpGateway) StartTopUp(context.Context, interfaces.TopUpStartRequest) (interfaces.StartedTopUp, error) {
	return interfaces.StartedTopUp{}, adserrors.TopUpsUnavailable
}

func (UnavailableTopUpGateway) ReadTopUp(context.Context, string, string) (interfaces.TopUpStatus, error) {
	return interfaces.TopUpStatus{}, adserrors.TopUpsUnavailable
}
