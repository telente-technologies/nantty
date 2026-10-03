package application

import (
	"context"
	"log/slog"
	"time"

	"zudomart/modules/users/internal/config"
	"zudomart/modules/users/internal/ent"
)

type PrivacyDependencies struct {
	Client   *ent.Client
	Settings config.PrivacySettings
	Logger   *slog.Logger
	Now      func() time.Time
}

type PrivacyApplication struct {
	PrivacyDependencies
}

func NewPrivacyApplication(dependencies PrivacyDependencies) *PrivacyApplication {
	if dependencies.Now == nil {
		dependencies.Now = time.Now
	}
	return &PrivacyApplication{PrivacyDependencies: dependencies}
}

func (application *PrivacyApplication) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	<-ctx.Done()
	return nil
}
