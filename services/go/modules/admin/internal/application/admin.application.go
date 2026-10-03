package application

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"zudomart/modules/admin/internal/config"
	"zudomart/modules/admin/internal/ent"
	"zudomart/platform/httpserver"
	"zudomart/platform/identityports"
	"zudomart/platform/passwordhash"
)

const eventSource = "zudomart.admin"

type Dependencies struct {
	Client    *ent.Client
	Settings  config.AdminSettings
	Passwords *passwordhash.PasswordHasher
	Tokens    func() (identityports.StaffTokenService, error)
	Delivery  InvitationDelivery
	Logger    *slog.Logger
	Now       func() time.Time
}

type AdminApplication struct {
	Dependencies
}

func NewAdminApplication(dependencies Dependencies) *AdminApplication {
	if dependencies.Now == nil {
		dependencies.Now = time.Now
	}
	if dependencies.Tokens == nil {
		dependencies.Tokens = identityports.Default.StaffTokenService
	}
	return &AdminApplication{Dependencies: dependencies}
}

var (
	errInvalidCredentials  = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_CREDENTIALS", "The email or password is incorrect.")
	errInvalidChallenge    = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_CHALLENGE", "Sign in again.")
	errInvalidMfaCode      = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_MFA_CODE", "The code is invalid or has expired.")
	errTooManyMfaAttempts  = httpserver.NewApiError(http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS", "Too many incorrect attempts. Sign in again.")
	errInvalidRefreshToken = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_REFRESH_TOKEN", "Your session has ended. Sign in again.")
	errRefreshTokenReused  = httpserver.NewApiError(http.StatusUnauthorized, "REFRESH_TOKEN_REUSED", "Your session has ended. Sign in again.")
	errInvalidInvitation   = httpserver.NewApiError(http.StatusBadRequest, "INVALID_INVITATION", "This invitation is invalid or has expired.")
	errEmailAlreadyInUse   = httpserver.NewApiError(http.StatusConflict, "EMAIL_TAKEN", "A staff account with this email already exists.")
	errStaffNotFound       = httpserver.NewApiError(http.StatusNotFound, "STAFF_NOT_FOUND", "That staff account was not found.")
	errSuperadminRequired  = httpserver.NewApiError(http.StatusForbidden, "SUPERADMIN_REQUIRED", "Only a superadmin can do that.")
	errMfaNotEnrolled      = httpserver.NewApiError(http.StatusConflict, "MFA_NOT_ENROLLED", "Set up multi-factor authentication first.")
	errSettingNotFound     = httpserver.NewApiError(http.StatusNotFound, "SETTING_NOT_FOUND", "That setting does not exist.")
	errVersionConflict     = httpserver.NewApiError(http.StatusConflict, "VERSION_CONFLICT", "This setting changed since you loaded it. Reload and try again.")
)

func unprocessable(message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, "UNPROCESSABLE", message)
}

func (application *AdminApplication) runInTransaction(ctx context.Context, work func(tx *ent.Tx) error) error {
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
