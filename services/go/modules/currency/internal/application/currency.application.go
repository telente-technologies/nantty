package application

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"zudomart/modules/currency/internal/config"
	"zudomart/modules/currency/internal/ent"
	"zudomart/platform/httpserver"
)

type IpCountryLookup interface {
	FindCountryCodeForIpAddress(ctx context.Context, ipAddress string) (string, error)
}

type Dependencies struct {
	Client   *ent.Client
	Settings config.CurrencySettings
	IpLookup IpCountryLookup
	Logger   *slog.Logger
	Now      func() time.Time
}

type CurrencyApplication struct {
	Dependencies
}

const eventSource = "zudomart.currency"

func NewCurrencyApplication(dependencies Dependencies) *CurrencyApplication {
	if dependencies.Now == nil {
		dependencies.Now = time.Now
	}
	return &CurrencyApplication{Dependencies: dependencies}
}

func unprocessable(code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, code, message)
}

var errUnsupportedCurrency = unprocessable("UNSUPPORTED_CURRENCY", "That currency is not supported.")

func (application *CurrencyApplication) runInTransaction(ctx context.Context, work func(tx *ent.Tx) error) error {
	tx, err := application.Client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	if err := work(tx); err != nil {
		return errors.Join(err, tx.Rollback())
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}
