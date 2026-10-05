package services

import (
	"context"
	"fmt"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/celebrationsetting"
	"zudomart/modules/users/src/generated/ent/celebrationview"
	"zudomart/modules/users/src/generated/ent/predicate"
	"zudomart/modules/users/src/generated/ent/profile"
	celebrationevents "zudomart/modules/users/src/modules/celebrations/events"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/modules/users/src/utils"
)

const (
	backfillBatchSize         = 200
	anniversaryEmailLocalHour = 8
)

type AnniversaryScheduler struct {
	Container *container.Container
}

func (scheduler AnniversaryScheduler) RunOnce(ctx context.Context) error {
	if err := scheduler.backfillJoinDates(ctx); err != nil {
		return fmt.Errorf("backfill join dates: %w", err)
	}
	return scheduler.emitDueAnniversaries(ctx, scheduler.Container.Now())
}

func (scheduler AnniversaryScheduler) backfillJoinDates(ctx context.Context) error {
	cursor := uuid.Nil
	for {
		batch, err := scheduler.Container.Client.Profile.Query().
			Where(profile.KindEQ(profile.KindPersonal), profile.IDGT(cursor)).Order(ent.Asc(profile.FieldID)).Limit(backfillBatchSize).All(ctx)
		if err != nil || len(batch) == 0 {
			return err
		}
		cursor = batch[len(batch)-1].ID
		accountIds := make([]uuid.UUID, 0, len(batch))
		for _, row := range batch {
			accountIds = append(accountIds, row.AccountID)
		}
		known, err := scheduler.Container.Client.CelebrationSetting.Query().
			Where(celebrationsetting.AccountIDIn(accountIds...), celebrationsetting.JoinedAtNotNil()).Select(celebrationsetting.FieldAccountID).Strings(ctx)
		if err != nil {
			return err
		}
		knownSet := map[string]bool{}
		for _, accountId := range known {
			knownSet[accountId] = true
		}
		for _, accountId := range accountIds {
			if knownSet[accountId.String()] {
				continue
			}
			summary, err := usersservices.LoadActiveAccountSummary(ctx, accountId)
			if err != nil {
				continue
			}
			if err := EnsureSettingRow(ctx, scheduler.Container, accountId, summary.CreatedAt); err != nil {
				return err
			}
		}
	}
}

func joinedWithinWindow(now time.Time) predicate.CelebrationSetting {
	days := map[string]bool{}
	for offset := -2; offset <= 2; offset++ {
		days[now.UTC().AddDate(0, 0, offset).Format("0102")] = true
	}
	if days["0228"] || days["0301"] {
		days["0229"] = true
	}
	args := make([]any, 0, len(days))
	for day := range days {
		args = append(args, day)
	}
	return predicate.CelebrationSetting(func(selector *sql.Selector) {
		selector.Where(sql.P(func(builder *sql.Builder) {
			builder.WriteString("to_char(").Ident(selector.C(celebrationsetting.FieldJoinedAt)).WriteString(" AT TIME ZONE 'UTC', 'MMDD') IN (").Args(args...).WriteString(")")
		}))
	})
}

func (scheduler AnniversaryScheduler) emitDueAnniversaries(ctx context.Context, now time.Time) error {
	candidates, err := scheduler.Container.Client.CelebrationSetting.Query().Where(celebrationsetting.JoinedAtNotNil(), joinedWithinWindow(now)).All(ctx)
	if err != nil {
		return err
	}
	for _, candidate := range candidates {
		day := utils.ComputeCelebrationDay(nil, *candidate.JoinedAt, candidate.Timezone, now)
		if !day.Anniversary || utils.LocalHour(now, candidate.Timezone) < anniversaryEmailLocalHour {
			continue
		}
		if _, err := usersservices.LoadActiveAccountSummary(ctx, candidate.AccountID); err != nil {
			continue
		}
		if err := scheduler.emitOnce(ctx, candidate, day, now); err != nil {
			return err
		}
	}
	return nil
}

func (scheduler AnniversaryScheduler) emitOnce(ctx context.Context, candidate *ent.CelebrationSetting, day utils.CelebrationDay, now time.Time) error {
	already, err := HasView(ctx, scheduler.Container, candidate.AccountID, "anniversary", "email", day.LocalDate)
	if err != nil || already {
		return err
	}
	stats := LoadAnniversaryStats(ctx, scheduler.Container, candidate.AccountID)
	data := celebrationevents.AnniversaryReachedData{
		AccountId: candidate.AccountID.String(), Years: day.AnniversaryYears, LocalDate: day.LocalDate, Timezone: timezoneOrUtc(candidate.Timezone),
		JoinedAt: candidate.JoinedAt.UTC().Format(time.RFC3339),
	}
	if stats != nil {
		data.Stats = &celebrationevents.AnniversaryStats{Posts: stats.Posts, Lives: stats.Lives, Followers: stats.Followers, Orders: stats.Orders}
	}
	err = scheduler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.CelebrationView.Create().SetAccountID(candidate.AccountID).SetKind(celebrationview.KindAnniversary).SetSurface(celebrationview.SurfaceEmail).SetLocalDate(day.LocalDate).Exec(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, celebrationevents.AnniversaryReachedType, candidate.AccountID.String(), now, data)
	})
	if ent.IsConstraintError(err) {
		return nil
	}
	return err
}

func timezoneOrUtc(name string) string {
	if name == "" {
		return "UTC"
	}
	return name
}
