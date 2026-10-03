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

const maximumPaystackResponseBytes = 2 << 20

type ProviderRequestError struct {
	Provider   string
	StatusCode int
	Code       string
	Message    string
}

func (failure *ProviderRequestError) Error() string {
	return fmt.Sprintf("%s returned %d %s: %s", failure.Provider, failure.StatusCode, failure.Code, failure.Message)
}

func (failure *ProviderRequestError) Unwrap() []error {
	wrapped := []error{interfaces.ErrProviderUnavailable}
	if failure.Code == "insufficient_balance" {
		wrapped = append(wrapped, interfaces.ErrInsufficientProviderBalance)
	}
	return wrapped
}

func (failure *ProviderRequestError) IsDefinitiveRejection() bool {
	return failure.StatusCode >= 400 && failure.StatusCode < 500 && failure.StatusCode != http.StatusTooManyRequests
}

type paystackRequest struct {
	method    string
	path      string
	query     url.Values
	body      any
	retrySafe bool
}

type paystackEnvelope struct {
	Status  bool            `json:"status"`
	Message string          `json:"message"`
	Code    string          `json:"code"`
	Data    json.RawMessage `json:"data"`
	Meta    json.RawMessage `json:"meta"`
}

type paystackHttpClient struct {
	baseUrl         string
	secretKey       string
	client          *http.Client
	maximumAttempts int
	retryBaseDelay  time.Duration
}

func (client paystackHttpClient) send(ctx context.Context, request paystackRequest, destination any) error {
	if client.secretKey == "" {
		return interfaces.ErrProviderNotConfigured
	}
	var encoded []byte
	if request.body != nil {
		var err error
		if encoded, err = json.Marshal(request.body); err != nil {
			return err
		}
	}
	attempts := 1
	if request.method == http.MethodGet || request.retrySafe {
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

func (client paystackHttpClient) sendOnce(ctx context.Context, request paystackRequest, encoded []byte, destination any) (bool, error) {
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
	response, err := client.client.Do(httpRequest)
	if err != nil {
		return ctx.Err() == nil, fmt.Errorf("%w: paystack request failed: %v", interfaces.ErrProviderUnavailable, err)
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, maximumPaystackResponseBytes))
	if err != nil {
		return true, fmt.Errorf("%w: read paystack response: %v", interfaces.ErrProviderUnavailable, err)
	}
	var envelope paystackEnvelope
	decodeErr := json.Unmarshal(raw, &envelope)
	if response.StatusCode < 200 || response.StatusCode > 299 || (decodeErr == nil && !envelope.Status) {
		failure := &ProviderRequestError{Provider: "paystack", StatusCode: response.StatusCode, Code: envelope.Code, Message: truncate(envelope.Message, 200)}
		if failure.StatusCode < 300 {
			failure.StatusCode = http.StatusBadRequest
		}
		return response.StatusCode >= 500 || response.StatusCode == http.StatusTooManyRequests, failure
	}
	if decodeErr != nil {
		return false, fmt.Errorf("%w: decode paystack response: %v", interfaces.ErrProviderUnavailable, decodeErr)
	}
	if destination == nil {
		return false, nil
	}
	if err := decodeInto(envelope, destination); err != nil {
		return false, fmt.Errorf("%w: decode paystack data: %v", interfaces.ErrProviderUnavailable, err)
	}
	return false, nil
}

type paystackPage[Item any] struct {
	Items []Item
	Meta  struct {
		Page      int `json:"page"`
		PageCount int `json:"pageCount"`
	}
}

func decodeInto(envelope paystackEnvelope, destination any) error {
	if page, isPage := destination.(interface {
		setPage(json.RawMessage, json.RawMessage) error
	}); isPage {
		return page.setPage(envelope.Data, envelope.Meta)
	}
	if len(envelope.Data) == 0 || string(envelope.Data) == "null" {
		return errors.New("empty data")
	}
	decoder := json.NewDecoder(bytes.NewReader(envelope.Data))
	decoder.UseNumber()
	return decoder.Decode(destination)
}

func (page *paystackPage[Item]) setPage(data, meta json.RawMessage) error {
	if err := json.Unmarshal(data, &page.Items); err != nil {
		return err
	}
	if len(meta) > 0 {
		return json.Unmarshal(meta, &page.Meta)
	}
	return nil
}

func truncate(value string, maximum int) string {
	if len(value) <= maximum {
		return value
	}
	return value[:maximum]
}
