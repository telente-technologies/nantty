package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"zudomart/modules/payments/src/integrations/providerHttp"
	"zudomart/modules/payments/src/interfaces"
)

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
	secretKey string
	transport *providerhttp.Client
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
	response, err := client.transport.Do(ctx, providerhttp.Request{Method: request.method, Path: request.path, Query: request.query, Body: encoded, IdempotentWrite: request.retrySafe})
	if err != nil && response.StatusCode == 0 {
		return err
	}
	var envelope paystackEnvelope
	decodeErr := json.Unmarshal(response.Body, &envelope)
	if response.StatusCode < 200 || response.StatusCode > 299 || (decodeErr == nil && !envelope.Status) {
		failure := &ProviderRequestError{Provider: "paystack", StatusCode: response.StatusCode, Code: envelope.Code, Message: providerhttp.RedactSecrets(truncate(envelope.Message, 200))}
		if failure.StatusCode < 300 {
			failure.StatusCode = http.StatusBadRequest
		}
		if err != nil {
			return errors.Join(err, failure)
		}
		return failure
	}
	if decodeErr != nil {
		return fmt.Errorf("%w: decode paystack response: %v", interfaces.ErrProviderUnavailable, decodeErr)
	}
	if destination == nil {
		return nil
	}
	if err := decodeInto(envelope, destination); err != nil {
		return fmt.Errorf("%w: decode paystack data: %v", interfaces.ErrProviderUnavailable, err)
	}
	return nil
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
