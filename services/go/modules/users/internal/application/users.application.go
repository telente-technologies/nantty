package application

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"zudomart/modules/users/internal/config"
	"zudomart/modules/users/internal/ent"
	"zudomart/platform/httpserver"
)

const eventSource = "zudomart.users"

type Dependencies struct {
	Client   *ent.Client
	Settings config.UsersSettings
	Logger   *slog.Logger
	Now      func() time.Time
}

type UsersApplication struct {
	Dependencies
}

func NewUsersApplication(dependencies Dependencies) *UsersApplication {
	if dependencies.Now == nil {
		dependencies.Now = time.Now
	}
	return &UsersApplication{Dependencies: dependencies}
}

var (
	errProfileNotFound      = httpserver.NewApiError(http.StatusNotFound, "PROFILE_NOT_FOUND", "That profile was not found.")
	errAccountUnavailable   = httpserver.NewApiError(http.StatusUnauthorized, "UNAUTHORIZED", "Sign in to continue.")
	errUsernameTakenByOther = httpserver.NewApiError(http.StatusConflict, "USERNAME_TAKEN", "That username is taken.")
)

func unprocessable(message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, "UNPROCESSABLE", message)
}

func (application *UsersApplication) runInTransaction(ctx context.Context, work func(tx *ent.Tx) error) error {
	return RunInTransaction(ctx, application.Client, work)
}

func RunInTransaction(ctx context.Context, client *ent.Client, work func(tx *ent.Tx) error) error {
	tx, err := client.Tx(ctx)
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
