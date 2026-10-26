package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"reflect"

	"nantty/modules/payments/src/integrations/providerHttp"
	"nantty/modules/payments/src/interfaces"
)

type flutterwaveRequest struct {
	method    string
	path      string
	query     url.Values
	body      any
	retrySafe bool
}

type flutterwaveEnvelope struct {
	Status  string          `json:"status"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
	Meta    json.RawMessage `json:"meta"`
}

type flutterwaveHttpClient struct {
	secretKey string
	transport *providerhttp.Client
}

func (client flutterwaveHttpClient) send(ctx context.Context, request flutterwaveRequest, destination any) (flutterwaveEnvelope, error) {
	if client.secretKey == "" {
		return flutterwaveEnvelope{}, interfaces.ErrProviderNotConfigured
	}
	var encoded []byte
	if request.body != nil {
		var err error
		if encoded, err = json.Marshal(request.body); err != nil {
			return flutterwaveEnvelope{}, err
		}
	}
	response, err := client.transport.Do(ctx, providerhttp.Request{Method: request.method, Path: request.path, Query: request.query, Body: encoded, IdempotentWrite: request.retrySafe})
	if err != nil && response.StatusCode == 0 {
		return flutterwaveEnvelope{}, err
	}
	var envelope flutterwaveEnvelope
	decodeErr := json.Unmarshal(response.Body, &envelope)
	if response.StatusCode < 200 || response.StatusCode > 299 || (decodeErr == nil && envelope.Status != "success") {
		failure := &ProviderRequestError{Provider: FlutterwaveProviderName, StatusCode: response.StatusCode, Message: providerhttp.RedactSecrets(truncate(envelope.Message, 200))}
		if failure.StatusCode < 300 {
			failure.StatusCode = http.StatusBadRequest
		}
		if err != nil {
			return envelope, errors.Join(err, failure)
		}
		return envelope, failure
	}
	if decodeErr != nil {
		return envelope, fmt.Errorf("%w: decode flutterwave response: %v", interfaces.ErrProviderUnavailable, decodeErr)
	}
	if destination == nil {
		return envelope, nil
	}
	if len(envelope.Data) == 0 || string(envelope.Data) == "null" {
		if target := reflect.ValueOf(destination); target.Kind() == reflect.Pointer && target.Elem().Kind() == reflect.Slice {
			return envelope, nil
		}
		return envelope, fmt.Errorf("%w: flutterwave returned no data", interfaces.ErrProviderUnavailable)
	}
	decoder := json.NewDecoder(bytes.NewReader(envelope.Data))
	decoder.UseNumber()
	if err := decoder.Decode(destination); err != nil {
		return envelope, fmt.Errorf("%w: decode flutterwave data: %v", interfaces.ErrProviderUnavailable, err)
	}
	return envelope, nil
}

func isFlutterwaveNotFound(err error) bool {
	var requestError *ProviderRequestError
	return errors.As(err, &requestError) && requestError.StatusCode == http.StatusNotFound
}

func isDefinitiveFlutterwaveRejection(err error) bool {
	var requestError *ProviderRequestError
	return errors.As(err, &requestError) && requestError.IsDefinitiveRejection()
}
