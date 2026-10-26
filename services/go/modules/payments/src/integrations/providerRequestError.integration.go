package integrations

import (
	"fmt"
	"net/http"

	"nantty/modules/payments/src/interfaces"
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

func truncate(value string, maximum int) string {
	if len(value) <= maximum {
		return value
	}
	return value[:maximum]
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
