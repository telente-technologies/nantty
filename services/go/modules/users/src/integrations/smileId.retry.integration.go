package integrations

import (
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (client *SmileIdClient) do(request *http.Request) (*http.Response, error) {
	safeClient := *client.Http
	safeClient.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return safeClient.Do(request)
}

func (client *SmileIdClient) doReadWithRetry(request *http.Request) (*http.Response, error) {
	if request.Method != http.MethodGet {
		return client.do(request)
	}
	const maxAttempts = 3
	const maxRetryAfter = 2 * time.Second
	var response *http.Response
	var err error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		response, err = client.do(request.Clone(request.Context()))
		if err == nil && response.StatusCode != http.StatusTooManyRequests && response.StatusCode < http.StatusInternalServerError {
			return response, nil
		}
		if attempt == maxAttempts-1 {
			return response, err
		}
		delay := 200 * time.Millisecond * time.Duration(1<<attempt)
		if response != nil {
			if retryAfter := smileRetryAfter(response.Header.Get("Retry-After"), time.Now()); retryAfter > maxRetryAfter {
				return response, nil
			} else if retryAfter > delay {
				delay = retryAfter
			}
			_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
			_ = response.Body.Close()
		}
		timer := time.NewTimer(delay)
		select {
		case <-request.Context().Done():
			timer.Stop()
			return nil, request.Context().Err()
		case <-timer.C:
		}
	}
	return response, err
}

func smileRetryAfter(value string, now time.Time) time.Duration {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	if seconds, err := strconv.Atoi(value); err == nil && seconds >= 0 {
		return time.Duration(seconds) * time.Second
	}
	if retryAt, err := http.ParseTime(value); err == nil && retryAt.After(now) {
		return retryAt.Sub(now)
	}
	return 0
}
