package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/celebrations/dtos"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/identityports"
)

func BuildViewerCelebrations(ctx context.Context, application *container.Container, accountId uuid.UUID) (dtos.ViewerCelebrations, error) {
	summary, err := usersservices.LoadActiveAccountSummary(ctx, accountId)
	if err != nil {
		return dtos.ViewerCelebrations{}, err
	}
	if err := EnsureSettingRow(ctx, application, accountId, summary.CreatedAt); err != nil {
		return dtos.ViewerCelebrations{}, err
	}
	settings, err := LoadSettings(ctx, application, accountId)
	if err != nil {
		return dtos.ViewerCelebrations{}, err
	}
	day := utils.ComputeCelebrationDay(summary.Birthday, summary.CreatedAt, settings.Timezone, application.Now())
	timezone := settings.Timezone
	if timezone == "" {
		timezone = "UTC"
	}
	view := dtos.ViewerCelebrations{
		Timezone: timezone, TimezoneConfigured: settings.Timezone != "", LocalDate: day.LocalDate, BirthdayBalloonsVisible: settings.BirthdayBalloonsVisible,
		Birthday: dtos.BirthdayCelebration{Today: day.Birthday, Age: day.Age}, Anniversary: dtos.AnniversaryCelebration{Today: day.Anniversary, Years: day.AnniversaryYears},
	}
	if day.Birthday {
		if view.Birthday.Shown, err = loadSurfaceState(ctx, application, accountId, "birthday", day.LocalDate); err != nil {
			return dtos.ViewerCelebrations{}, err
		}
	}
	if day.Anniversary {
		if view.Anniversary.Shown, err = loadSurfaceState(ctx, application, accountId, "anniversary", day.LocalDate); err != nil {
			return dtos.ViewerCelebrations{}, err
		}
		view.Anniversary.Stats = LoadAnniversaryStats(ctx, application, accountId)
	}
	return view, nil
}

func loadSurfaceState(ctx context.Context, application *container.Container, accountId uuid.UUID, kind, localDate string) (dtos.SurfaceState, error) {
	app, err := HasView(ctx, application, accountId, kind, "app", localDate)
	if err != nil {
		return dtos.SurfaceState{}, err
	}
	profile, err := HasView(ctx, application, accountId, kind, "profile", localDate)
	return dtos.SurfaceState{App: app, Profile: profile}, err
}

func MarkSeen(ctx context.Context, application *container.Container, accountId uuid.UUID, request dtos.MarkSeenRequest) error {
	current, err := BuildViewerCelebrations(ctx, application, accountId)
	if err != nil {
		return err
	}
	return RecordView(ctx, application, accountId, request.Kind, request.Surface, current.LocalDate)
}

func ComputePublicFlags(ctx context.Context, application *container.Container, summary identityports.AccountSummary, forSelf bool) dtos.PublicFlags {
	settings, err := LoadSettings(ctx, application, summary.ID)
	if err != nil {
		return dtos.PublicFlags{}
	}
	day := utils.ComputeCelebrationDay(summary.Birthday, summary.CreatedAt, settings.Timezone, application.Now())
	return dtos.PublicFlags{BirthdayToday: day.Birthday && (forSelf || settings.BirthdayBalloonsVisible), AnniversaryToday: day.Anniversary}
}
