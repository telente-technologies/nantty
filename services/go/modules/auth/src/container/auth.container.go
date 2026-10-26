package container

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"nantty/modules/auth/src/configs"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/integrations"
	signingkeys "nantty/modules/auth/src/modules/signingKeys/services"
	"nantty/modules/auth/src/utils"
	"nantty/platform/jwtauth"
)

type Container struct {
	Client         *ent.Client
	Settings       configs.AuthSettings
	Passwords      *utils.PasswordHasher
	TokenIssuer    *signingkeys.AccessTokenIssuer
	Delivery       integrations.OneTimeCodeDelivery
	Social         *integrations.IdentityTokenVerifier
	Keys           *signingkeys.SigningKeyService
	AccessVerifier *jwtauth.AccessTokenVerifier
	Logger         *slog.Logger
	Now            func() time.Time
}

func (container *Container) RunInTransaction(ctx context.Context, work func(tx *ent.Tx) error) error {
	tx, err := container.Client.Tx(ctx)
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
