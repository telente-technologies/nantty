package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/usernamechange"
)

const oneYear = 365 * 24 * time.Hour

type ChangeWindow struct {
	NextChangeAvailableAt *time.Time
	ChangesUsedThisYear   int
	History               []*ent.UsernameChange
}

func CalculateChangeWindow(ctx context.Context, application *container.Container, accountId uuid.UUID) (ChangeWindow, error) {
	history, err := application.Client.UsernameChange.Query().Where(usernamechange.AccountID(accountId)).Order(ent.Desc(usernamechange.FieldCreatedAt)).Limit(50).All(ctx)
	if err != nil {
		return ChangeWindow{}, err
	}
	now := application.Now()
	var userChanges []*ent.UsernameChange
	for _, change := range history {
		if change.Reason == usernamechange.ReasonUserChange {
			userChanges = append(userChanges, change)
		}
	}
	window := ChangeWindow{History: history}
	var next time.Time
	if len(userChanges) > 0 {
		next = userChanges[0].CreatedAt.Add(application.Settings.UsernameChangeCooldown)
	}
	var withinYear []*ent.UsernameChange
	for _, change := range userChanges {
		if now.Sub(change.CreatedAt) < oneYear {
			withinYear = append(withinYear, change)
		}
	}
	window.ChangesUsedThisYear = len(withinYear)
	if len(withinYear) >= application.Settings.UsernameMaximumChangesYear {
		oldestCounted := withinYear[application.Settings.UsernameMaximumChangesYear-1]
		if release := oldestCounted.CreatedAt.Add(oneYear); release.After(next) {
			next = release
		}
	}
	if next.After(now) {
		window.NextChangeAvailableAt = &next
	}
	return window, nil
}
