package providerhttp

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

const maximumResponseBytes = 2 << 20

var (
	ErrOutcomeUnknown = errors.New("the provider may have applied this write; confirm it by reference before retrying")
	ErrCircuitOpen    = errors.New("the provider circuit is open; the request was not sent")
)

type Request struct {
	Method          string
	Path            string
	Query           url.Values
	Body            []byte
	Headers         http.Header
	IdempotentWrite bool
}

type Response struct {
	StatusCode int
	Header     http.Header
	Body       []byte
}

type Client struct {
	Provider       string
	BaseUrl        string
	Authorize      func(*http.Request)
	HttpClient     *http.Client
	ReadAttempts   int
	RetryBaseDelay time.Duration
	MaximumDelay   time.Duration
	Breaker        *Breaker
	Now            func() time.Time
}

func (client *Client) retriable(request Request) bool {
	return request.Method == http.MethodGet || request.Method == http.MethodHead || request.IdempotentWrite
}

func (client *Client) Do(ctx context.Context, request Request) (Response, error) {
	attempts := 1
	if client.retriable(request) {
		attempts = max(client.ReadAttempts, 1)
	}
	var last Response
	var lastError error
	for attempt := 0; attempt < attempts; attempt++ {
		if attempt > 0 {
			if err := sleep(ctx, client.backoff(attempt, last.Header)); err != nil {
				return last, err
			}
		}
		response, retry, err := client.once(ctx, request)
		if err == nil || !retry {
			return response, err
		}
		last, lastError = response, err
	}
	return last, lastError
}

func (client *Client) once(ctx context.Context, request Request) (Response, bool, error) {
	now := client.clock()
	if client.Breaker != nil && !client.Breaker.Allow(now) {
		return Response{}, false, fmt.Errorf("%w: %w (%s)", interfaces.ErrProviderUnavailable, ErrCircuitOpen, client.Provider)
	}
	target := client.BaseUrl + request.Path
	if len(request.Query) > 0 {
		target += "?" + request.Query.Encode()
	}
	var body io.Reader
	if request.Body != nil {
		body = bytes.NewReader(request.Body)
	}
	httpRequest, err := http.NewRequestWithContext(ctx, request.Method, target, body)
	if err != nil {
		return Response{}, false, err
	}
	for name, values := range request.Headers {
		httpRequest.Header[name] = values
	}
	httpRequest.Header.Set("Accept", "application/json")
	if request.Body != nil {
		httpRequest.Header.Set("Content-Type", "application/json")
	}
	if client.Authorize != nil {
		client.Authorize(httpRequest)
	}
	response, err := client.HttpClient.Do(httpRequest)
	if err != nil {
		client.record(false)
		return Response{}, ctx.Err() == nil, client.unreachable(request, err)
	}
	defer response.Body.Close()
	raw, readErr := io.ReadAll(io.LimitReader(response.Body, maximumResponseBytes))
	result := Response{StatusCode: response.StatusCode, Header: response.Header, Body: raw}
	serverFailure := response.StatusCode >= 500
	client.record(!serverFailure && readErr == nil)
	if readErr != nil {
		return result, true, client.unreachable(request, readErr)
	}
	if serverFailure || response.StatusCode == http.StatusTooManyRequests {
		failure := fmt.Errorf("%w: %s returned %d", interfaces.ErrProviderUnavailable, client.Provider, response.StatusCode)
		if serverFailure && !client.retriable(request) {
			failure = fmt.Errorf("%w: %w", failure, ErrOutcomeUnknown)
		}
		return result, true, failure
	}
	return result, false, nil
}

func (client *Client) unreachable(request Request, cause error) error {
	failure := fmt.Errorf("%w: %s %s %s failed: %s", interfaces.ErrProviderUnavailable, client.Provider, request.Method, strings.SplitN(request.Path, "?", 2)[0], RedactSecrets(describeTransportError(cause)))
	if !client.retriable(request) {
		return fmt.Errorf("%w: %w", failure, ErrOutcomeUnknown)
	}
	return failure
}

func describeTransportError(cause error) string {
	var urlError *url.Error
	if errors.As(cause, &urlError) {
		return urlError.Err.Error()
	}
	return cause.Error()
}

func (client *Client) record(succeeded bool) {
	if client.Breaker != nil {
		client.Breaker.Record(client.clock(), succeeded)
	}
}

func (client *Client) clock() time.Time {
	if client.Now != nil {
		return client.Now()
	}
	return time.Now()
}

func (client *Client) backoff(attempt int, header http.Header) time.Duration {
	ceiling := client.MaximumDelay
	if ceiling <= 0 {
		ceiling = 10 * time.Second
	}
	if seconds, err := strconv.Atoi(header.Get("Retry-After")); err == nil && seconds > 0 {
		return min(time.Duration(seconds)*time.Second, ceiling)
	}
	if client.RetryBaseDelay <= 0 {
		return 0
	}
	delay := min(client.RetryBaseDelay<<(attempt-1), ceiling)
	return delay/2 + rand.N(delay/2+1)
}

func sleep(ctx context.Context, delay time.Duration) error {
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
