package container

import (
	"context"
	stderrors "errors"
	"fmt"
	"log/slog"
	"time"

	"zudomart/modules/admin/src/configs"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/integrations"
	"zudomart/modules/admin/src/middlewares"
	"zudomart/platform/identityports"
	"zudomart/platform/passwordhash"
	"zudomart/platform/staffauth"
)

type Container struct {
	Client    *ent.Client
	Settings  configs.AdminSettings
	Passwords *passwordhash.PasswordHasher
	Tokens    func() (identityports.StaffTokenService, error)
	Delivery  integrations.InvitationDelivery
	Logger    *slog.Logger
	Now       func() time.Time
	Guard     staffauth.Guard
	Limiter   *middlewares.AttemptRateLimiter
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
