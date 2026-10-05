package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/interfaces"
	"zudomart/platform/httpserver"
)

type HttpMoneyTopUpGateway struct {
	BaseUrl string
	Http    *http.Client
}

type moneyTopUpResponse struct {
	Id          string  `json:"id"`
	Reference   string  `json:"reference"`
	CheckoutUrl *string `json:"checkoutUrl"`
}

func (gateway HttpMoneyTopUpGateway) StartTopUp(ctx context.Context, request interfaces.TopUpStartRequest) (interfaces.StartedTopUp, error) {
	body, _ := json.Marshal(map[string]any{
		"adAccountId": request.AdAccountId, "amount": map[string]any{"amountMinor": request.AmountMinor, "currency": request.Currency}, "returnTo": request.ReturnTo,
	})
	outgoing, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(gateway.BaseUrl, "/")+"/api/v1/ads/balance/top-ups", bytes.NewReader(body))
	if err != nil {
		return interfaces.StartedTopUp{}, err
	}
	outgoing.Header.Set("Content-Type", "application/json")
	outgoing.Header.Set("Authorization", "Bearer "+request.BearerToken)
	outgoing.Header.Set("Idempotency-Key", request.IdempotencyKey)
	response, err := gateway.Http.Do(outgoing)
	if err != nil {
		return interfaces.StartedTopUp{}, adserrors.TopUpsUnavailable
	}
	defer response.Body.Close()
	payload, _ := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if response.StatusCode >= 500 {
		return interfaces.StartedTopUp{}, adserrors.TopUpsUnavailable
	}
	if response.StatusCode >= 400 {
		return interfaces.StartedTopUp{}, relayMoneyError(response.StatusCode, payload)
	}
	var started moneyTopUpResponse
	if err := json.Unmarshal(payload, &started); err != nil || started.Id == "" || started.Reference == "" {
		return interfaces.StartedTopUp{}, fmt.Errorf("money returned an unreadable top-up")
	}
	result := interfaces.StartedTopUp{TopUpId: started.Id, Reference: started.Reference}
	if started.CheckoutUrl != nil {
		result.CheckoutUrl = *started.CheckoutUrl
	}
	return result, nil
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
