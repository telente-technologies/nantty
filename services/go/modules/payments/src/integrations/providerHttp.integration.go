package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

const maximumProviderResponseBytes = 2 << 20

type ProviderRequestError struct {
	Provider   string
	StatusCode int
	Message    string
}

func (failure *ProviderRequestError) Error() string {
	return fmt.Sprintf("%s returned %d: %s", failure.Provider, failure.StatusCode, failure.Message)
}

func (failure *ProviderRequestError) Unwrap() error { return interfaces.ErrProviderUnavailable }

type providerHttpClient struct {
	provider  string
	baseUrl   string
	secretKey string
	client    *http.Client
}

func newProviderHttpClient(provider, baseUrl, secretKey string) providerHttpClient {
	return providerHttpClient{provider: provider, baseUrl: baseUrl, secretKey: secretKey, client: &http.Client{Timeout: 15 * time.Second}}
}

func (client providerHttpClient) sendJson(ctx context.Context, method, path string, body any, destination any) error {
	if client.secretKey == "" {
		return interfaces.ErrProviderNotConfigured
	}
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, client.baseUrl+path, reader)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+client.secretKey)
	request.Header.Set("Accept", "application/json")
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := client.client.Do(request)
	if err != nil {
		return fmt.Errorf("%w: %s request failed: %v", interfaces.ErrProviderUnavailable, client.provider, err)
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, maximumProviderResponseBytes))
	if err != nil {
		return fmt.Errorf("%w: read %s response: %v", interfaces.ErrProviderUnavailable, client.provider, err)
	}
	if response.StatusCode < 200 || response.StatusCode > 299 {
		var envelope struct {
			Message string `json:"message"`
		}
		_ = json.Unmarshal(raw, &envelope)
		return &ProviderRequestError{Provider: client.provider, StatusCode: response.StatusCode, Message: truncate(envelope.Message, 200)}
	}
	if destination == nil {
		return nil
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("%w: decode %s response: %v", interfaces.ErrProviderUnavailable, client.provider, err)
	}
	return nil
}

func truncate(value string, maximum int) string {
	if len(value) <= maximum {
		return value
	}
	return value[:maximum]
}
