package integrations

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"time"

	"zudomart/platform/httpserver"
)

type MoneyDisputeResponse struct {
	Status int
	Body   []byte
}

type MoneyDisputesClient struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

var ErrMoneyDisputesUnavailable = httpserver.NewApiError(http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "Disputes are unavailable right now. Try again.")

func NewMoneyDisputesClient(baseUrl, token string) MoneyDisputesClient {
	return MoneyDisputesClient{BaseUrl: baseUrl, Token: token, Http: &http.Client{Timeout: 5 * time.Second}}
}

func (client MoneyDisputesClient) Forward(ctx context.Context, method, path string, body []byte, idempotencyKey string) (MoneyDisputeResponse, error) {
	if client.BaseUrl == "" {
		return MoneyDisputeResponse{}, ErrMoneyDisputesUnavailable
	}
	request, err := http.NewRequestWithContext(ctx, method, client.BaseUrl+path, bytes.NewReader(body))
	if err != nil {
		return MoneyDisputeResponse{}, err
	}
	request.Header.Set("X-Internal-Token", client.Token)
	request.Header.Set("Content-Type", "application/json")
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	response, err := client.Http.Do(request)
	if err != nil {
		return MoneyDisputeResponse{}, ErrMoneyDisputesUnavailable
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return MoneyDisputeResponse{}, ErrMoneyDisputesUnavailable
	}
	if response.StatusCode >= 500 {
		return MoneyDisputeResponse{}, ErrMoneyDisputesUnavailable
	}
	return MoneyDisputeResponse{Status: response.StatusCode, Body: payload}, nil
}
