package container

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"zudomart/modules/live/src/configs"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/integrations"
	"zudomart/modules/live/src/interfaces"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
)

type Container struct {
	Client           *ent.Client
	Settings         configs.LiveSettings
	Money            interfaces.MoneyGateway
	Directory        interfaces.ParticipantDirectory
	Media            interfaces.MediaRoomController
	Tokens           *integrations.TokenIssuer
	PinPolicy        interfaces.ProductPinPolicy
	Logger           *slog.Logger
	Now              func() time.Time
	AccessVerifier   *jwtauth.AccessTokenVerifier
	IdempotencyStore *idempotency.RedisStore
	Ingress          interfaces.IngressController
	Recorder         interfaces.RecordingController
	RecordingStorage interfaces.RecordingStorage
	Relations        interfaces.SocialRelations
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
