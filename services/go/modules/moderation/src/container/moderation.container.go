package container

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"nantty/modules/moderation/src/configs"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/integrations"
	"nantty/modules/moderation/src/middlewares"
	"nantty/platform/jwtauth"
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
	ChatReportability integrations.ChatReportabilityChecker
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
