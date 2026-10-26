package integrations

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"time"

	"nantty/platform/httpserver"
)

type MoneySellerResponse struct {
	Status  int
	Headers http.Header
	Body    []byte
}

type MoneySellerAccountsClient struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

var ErrSellerMoneyUnavailable = httpserver.NewApiError(http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "Your wallet is unavailable right now. Try again.")

func NewMoneySellerAccountsClient(baseUrl, token string) MoneySellerAccountsClient {
	return MoneySellerAccountsClient{BaseUrl: baseUrl, Token: token, Http: &http.Client{Timeout: 10 * time.Second}}
}

func (client MoneySellerAccountsClient) Forward(ctx context.Context, method, path string, headers map[string]string, body []byte) (MoneySellerResponse, error) {
	if client.BaseUrl == "" {
		return MoneySellerResponse{}, ErrSellerMoneyUnavailable
	}
	request, err := http.NewRequestWithContext(ctx, method, client.BaseUrl+path, bytes.NewReader(body))
	if err != nil {
		return MoneySellerResponse{}, err
	}
	request.Header.Set("X-Internal-Token", client.Token)
	if len(body) > 0 {
		request.Header.Set("Content-Type", "application/json")
	}
	for name, value := range headers {
		if value != "" {
			request.Header.Set(name, value)
		}
	}
	response, err := client.Http.Do(request)
	if err != nil {
		return MoneySellerResponse{}, ErrSellerMoneyUnavailable
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if err != nil || response.StatusCode >= 500 {
		return MoneySellerResponse{}, ErrSellerMoneyUnavailable
	}
	return MoneySellerResponse{Status: response.StatusCode, Headers: response.Header, Body: payload}, nil
}
