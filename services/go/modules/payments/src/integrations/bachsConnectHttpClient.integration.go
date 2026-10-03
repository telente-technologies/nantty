package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

const maximumBachsResponseBytes = 2 << 20

type ProviderRequestError struct {
	Provider   string
	StatusCode int
	ErrorCode  string
	Message    string
}

func (failure *ProviderRequestError) Error() string {
	return fmt.Sprintf("%s returned %d %s: %s", failure.Provider, failure.StatusCode, failure.ErrorCode, failure.Message)
}

func (failure *ProviderRequestError) Unwrap() []error {
	wrapped := []error{interfaces.ErrProviderUnavailable}
	switch failure.ErrorCode {
	case "INSUFFICIENT_BALANCE":
		wrapped = append(wrapped, interfaces.ErrInsufficientProviderBalance)
	case "ORGANIZATION_IN_DEBT":
		wrapped = append(wrapped, interfaces.ErrConnectedAccountInDebt)
	}
	return wrapped
}

func (failure *ProviderRequestError) IsDefinitiveRejection() bool {
	return failure.StatusCode >= 400 && failure.StatusCode < 500 && failure.StatusCode != http.StatusTooManyRequests && failure.StatusCode != http.StatusConflict
}

type bachsRequest struct {
	method             string
	path               string
	query              url.Values
	body               any
	connectedAccountId string
	idempotencyKey     string
}

type bachsConnectHttpClient struct {
	baseUrl         string
	secretKey       string
	client          *http.Client
	maximumAttempts int
	retryBaseDelay  time.Duration
}

func (client bachsConnectHttpClient) isRetryable(request bachsRequest) bool {
	return request.method == http.MethodGet || request.idempotencyKey != ""
}

func (client bachsConnectHttpClient) send(ctx context.Context, request bachsRequest, destination any) error {
	if client.secretKey == "" {
		return interfaces.ErrProviderNotConfigured
	}
	if request.method != http.MethodGet && request.idempotencyKey == "" {
		return errors.New("bachs: every mutation needs an idempotency key")
	}
	var encoded []byte
	if request.body != nil {
		var err error
		if encoded, err = json.Marshal(request.body); err != nil {
			return err
		}
	}
	attempts := 1
	if client.isRetryable(request) {
		attempts = max(client.maximumAttempts, 1)
	}
	var lastError error
	for attempt := 0; attempt < attempts; attempt++ {
		if attempt > 0 {
			if err := waitBeforeRetry(ctx, client.retryBaseDelay<<(attempt-1)); err != nil {
				return err
			}
		}
		retry, err := client.sendOnce(ctx, request, encoded, destination)
		if err == nil || !retry {
			return err
		}
		lastError = err
	}
	return lastError
}

func waitBeforeRetry(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return ctx.Err()
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (client bachsConnectHttpClient) sendOnce(ctx context.Context, request bachsRequest, encoded []byte, destination any) (bool, error) {
	target := client.baseUrl + request.path
	if len(request.query) > 0 {
		target += "?" + request.query.Encode()
	}
	var reader io.Reader
	if encoded != nil {
		reader = bytes.NewReader(encoded)
	}
	httpRequest, err := http.NewRequestWithContext(ctx, request.method, target, reader)
	if err != nil {
		return false, err
	}
	httpRequest.Header.Set("Authorization", "Bearer "+client.secretKey)
	httpRequest.Header.Set("Accept", "application/json")
	if encoded != nil {
		httpRequest.Header.Set("Content-Type", "application/json")
	}
	if request.connectedAccountId != "" {
		httpRequest.Header.Set("X-Account-Id", request.connectedAccountId)
	}
	if request.idempotencyKey != "" {
		httpRequest.Header.Set("Idempotency-Key", request.idempotencyKey)
	}
	response, err := client.client.Do(httpRequest)
	if err != nil {
		return ctx.Err() == nil, fmt.Errorf("%w: bachs request failed: %v", interfaces.ErrProviderUnavailable, err)
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, maximumBachsResponseBytes))
	if err != nil {
		return true, fmt.Errorf("%w: read bachs response: %v", interfaces.ErrProviderUnavailable, err)
	}
	if response.StatusCode < 200 || response.StatusCode > 299 {
		var envelope struct {
			Detail    string `json:"detail"`
			ErrorCode string `json:"error_code"`
		}
		_ = json.Unmarshal(raw, &envelope)
		failure := &ProviderRequestError{Provider: "bachs", StatusCode: response.StatusCode, ErrorCode: envelope.ErrorCode, Message: truncate(envelope.Detail, 200)}
		retry := response.StatusCode >= 500 || response.StatusCode == http.StatusTooManyRequests || envelope.ErrorCode == "IDEMPOTENCY_IN_PROGRESS"
		return retry, failure
	}
	if destination == nil {
		return false, nil
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(destination); err != nil {
		return false, fmt.Errorf("%w: decode bachs response: %v", interfaces.ErrProviderUnavailable, err)
	}
	return false, nil
}

func truncate(value string, maximum int) string {
	if len(value) <= maximum {
		return value
	}
	return value[:maximum]
}
