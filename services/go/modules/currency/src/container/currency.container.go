package container

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"zudomart/modules/currency/src/configs"
	"zudomart/modules/currency/src/generated/ent"
	"zudomart/modules/currency/src/interfaces"
	"zudomart/platform/identityports"
)

type Container struct {
	Client   *ent.Client
	Settings configs.CurrencySettings
	Logger   *slog.Logger
	Now      func() time.Time
	IpLookup interfaces.IpCountryLookup
	Identity *identityports.Registry
}

func NewContainer(client *ent.Client, settings configs.CurrencySettings, logger *slog.Logger) *Container {
	return &Container{Client: client, Settings: settings, Logger: logger, Now: time.Now, Identity: identityports.Default}
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
