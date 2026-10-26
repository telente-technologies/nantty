package container

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"nantty/modules/live/src/configs"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/integrations"
	"nantty/modules/live/src/interfaces"
	platformevents "nantty/platform/events"
	"nantty/platform/idempotency"
	"nantty/platform/jwtauth"
)

type Container struct {
	Client           *ent.Client
	Settings         configs.LiveSettings
	Money            interfaces.MoneyGateway
	Directory        interfaces.ParticipantDirectory
	Media            interfaces.MediaRoomController
	Tokens           *integrations.TokenIssuer
	Catalog          interfaces.StoreCatalog
	Subscribers      interfaces.SubscriberDirectory
	Logger           *slog.Logger
	Now              func() time.Time
	AccessVerifier   *jwtauth.AccessTokenVerifier
	StaffVerifier    *jwtauth.AccessTokenVerifier
	IdempotencyStore *idempotency.RedisStore
	Ingress          interfaces.IngressController
	Recorder         interfaces.RecordingController
	RecordingStorage interfaces.RecordingStorage
	Relations        interfaces.SocialRelations
	SafetyCapture    interfaces.SafetyCaptureController
	SafetyObjects    interfaces.SafetyObjectLister
	Jobs             platformevents.JobQueue
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
