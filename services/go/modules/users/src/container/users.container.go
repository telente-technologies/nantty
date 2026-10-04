package container

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/configs"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/platform/jwtauth"
)

type Container struct {
	Client             *ent.Client
	Settings           configs.UsersSettings
	Logger             *slog.Logger
	Now                func() time.Time
	AccessVerifier     *jwtauth.AccessTokenVerifier
	PendingWithdrawals PendingWithdrawalChecker
	ActivityCounts     ActivityCountSource
}

type ActivityCountSource interface {
	PostsAndLivesLastYear(ctx context.Context, accountId uuid.UUID) (posts *int, lives *int)
}

type PendingWithdrawalChecker interface {
	HasPendingWithdrawals(ctx context.Context, accountId uuid.UUID) (bool, error)
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
