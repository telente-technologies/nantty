package container

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"zudomart/modules/moderation/src/configs"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/integrations"
	"zudomart/modules/moderation/src/middlewares"
	"zudomart/platform/jwtauth"
)

type Container struct {
	Client            *ent.Client
	Settings          configs.ModerationSettings
	Logger            *slog.Logger
	Now               func() time.Time
	AccessVerifier    *jwtauth.AccessTokenVerifier
	StaffVerifiers    middlewares.StaffTokenVerifiers
	Users             integrations.UsersService
	Audit             integrations.AuditService
	Targets           integrations.TargetResolver
	EvidenceVault     integrations.EvidenceVault
	FramePreviews     integrations.FramePreviewSigner
	DeviceAttestation integrations.DeviceAttestationVerifier
	AudioMatches      integrations.AudioMatchAdvisor
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
