package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/celebrationsetting"
	"zudomart/modules/users/src/generated/ent/celebrationview"
	"zudomart/modules/users/src/generated/ent/profilesignal"
	"zudomart/modules/users/src/modules/celebrations/dtos"
)

type SettingsView struct {
	Timezone                string
	BirthdayBalloonsVisible bool
	JoinedAt                *time.Time
}

func LoadSettings(ctx context.Context, application *container.Container, accountId uuid.UUID) (SettingsView, error) {
	row, err := application.Client.CelebrationSetting.Query().Where(celebrationsetting.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return SettingsView{BirthdayBalloonsVisible: true}, nil
	}
	if err != nil {
		return SettingsView{}, err
	}
	return SettingsView{Timezone: row.Timezone, BirthdayBalloonsVisible: row.BirthdayBalloonsVisible, JoinedAt: row.JoinedAt}, nil
}

func EnsureSettingRow(ctx context.Context, application *container.Container, accountId uuid.UUID, joinedAt time.Time) error {
	existing, err := application.Client.CelebrationSetting.Query().Where(celebrationsetting.AccountID(accountId)).Only(ctx)
	if err == nil {
		if existing.JoinedAt == nil {
			return application.Client.CelebrationSetting.UpdateOneID(existing.ID).SetJoinedAt(joinedAt).Exec(ctx)
		}
		return nil
	}
	if !ent.IsNotFound(err) {
		return err
	}
	err = application.Client.CelebrationSetting.Create().SetAccountID(accountId).SetJoinedAt(joinedAt).Exec(ctx)
	if ent.IsConstraintError(err) {
		return nil
	}
	return err
}

func UpdateSettings(ctx context.Context, application *container.Container, accountId uuid.UUID, joinedAt time.Time, request dtos.UpdateSettingsRequest) error {
	if err := EnsureSettingRow(ctx, application, accountId, joinedAt); err != nil {
		return err
	}
	update := application.Client.CelebrationSetting.Update().Where(celebrationsetting.AccountID(accountId))
	if request.Timezone != nil {
		update.SetTimezone(*request.Timezone)
	}
	if request.BirthdayBalloonsVisible != nil {
		update.SetBirthdayBalloonsVisible(*request.BirthdayBalloonsVisible)
	}
	return update.Exec(ctx)
}

func RecordView(ctx context.Context, application *container.Container, accountId uuid.UUID, kind, surface, localDate string) error {
	err := application.Client.CelebrationView.Create().
		SetAccountID(accountId).SetKind(celebrationview.Kind(kind)).SetSurface(celebrationview.Surface(surface)).SetLocalDate(localDate).
		Exec(ctx)
	if ent.IsConstraintError(err) {
		return nil
	}
	return err
}

func HasView(ctx context.Context, application *container.Container, accountId uuid.UUID, kind, surface, localDate string) (bool, error) {
	return application.Client.CelebrationView.Query().Where(
		celebrationview.AccountID(accountId), celebrationview.KindEQ(celebrationview.Kind(kind)),
		celebrationview.SurfaceEQ(celebrationview.Surface(surface)), celebrationview.LocalDate(localDate),
	).Exist(ctx)
}

func LoadAnniversaryStats(ctx context.Context, application *container.Container, accountId uuid.UUID) *dtos.AnniversaryStats {
	signal, err := application.Client.ProfileSignal.Query().Where(profilesignal.AccountID(accountId)).First(ctx)
	if err != nil {
		return nil
	}
	stats := dtos.AnniversaryStats{}
	if signal.RealFollowers > 0 {
		followers := signal.RealFollowers
		stats.Followers = &followers
	}
	if signal.CompletedOrders > 0 {
		orders := signal.CompletedOrders
		stats.Orders = &orders
	}
	if application.ActivityCounts != nil {
		stats.Posts, stats.Lives = application.ActivityCounts.PostsAndLivesLastYear(ctx, accountId)
		stats.Posts, stats.Lives = positiveOrNil(stats.Posts), positiveOrNil(stats.Lives)
	}
	if stats.Followers == nil && stats.Orders == nil && stats.Posts == nil && stats.Lives == nil {
		return nil
	}
	return &stats
}

func positiveOrNil(value *int) *int {
	if value == nil || *value <= 0 {
		return nil
	}
	return value
}
