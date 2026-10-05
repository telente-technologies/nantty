package container

import (
	"context"
	"database/sql"
	stderrors "errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"

	"zudomart/modules/admin/src/configs"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/integrations"
	"zudomart/modules/admin/src/middlewares"
	recoverycodes "zudomart/modules/admin/src/utils/recoveryCodes"
	"zudomart/platform/identityports"
	"zudomart/platform/passwordhash"
	"zudomart/platform/staffauth"
)

type Container struct {
	Client    *ent.Client
	Database  *sql.DB
	Settings  configs.AdminSettings
	Passwords *passwordhash.PasswordHasher
	Tokens    func() (identityports.StaffTokenService, error)
	Delivery  integrations.InvitationDelivery
	Logger    *slog.Logger
	Now       func() time.Time
	Guard     staffauth.Guard
	Limiter   *middlewares.AttemptRateLimiter
	WebAuthn  *webauthn.WebAuthn
}

func (container *Container) RecoveryCodeKey() []byte {
	return recoverycodes.DeriveHashKey(container.Settings.TotpEncryptionKey)
}

func (container *Container) RunInTransaction(ctx context.Context, work func(tx *ent.Tx) error) error {
	tx, err := container.Client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	if err := work(tx); err != nil {
		return stderrors.Join(err, tx.Rollback())
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}
