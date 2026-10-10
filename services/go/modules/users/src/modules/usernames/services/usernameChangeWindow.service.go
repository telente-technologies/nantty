package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/usernamechange"
	"zudomart/modules/users/src/services"
)

const oneYear = 365 * 24 * time.Hour

type ChangeWindow struct {
	NextChangeAvailableAt *time.Time
	ChangesUsedThisYear   int
	History               []*ent.UsernameChange
	Rules                 services.UsernameRules
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
	rules := services.LoadUsernameRules(ctx, application)
	window := ChangeWindow{History: history, Rules: rules}
	var next time.Time
	var withinWindow, withinYear []*ent.UsernameChange
	for _, change := range userChanges {
		if now.Sub(change.CreatedAt) < rules.ChangeWindow {
			withinWindow = append(withinWindow, change)
		}
		if now.Sub(change.CreatedAt) < oneYear {
			withinYear = append(withinYear, change)
		}
	}
	if rules.ChangesAllowedPerWindow == 0 {
		next = now.Add(rules.ChangeWindow)
	} else if len(withinWindow) >= rules.ChangesAllowedPerWindow {
		next = withinWindow[rules.ChangesAllowedPerWindow-1].CreatedAt.Add(rules.ChangeWindow)
	}
	window.ChangesUsedThisYear = len(withinYear)
	if rules.MaximumChangesPerYear > 0 && len(withinYear) >= rules.MaximumChangesPerYear {
		oldestCounted := withinYear[rules.MaximumChangesPerYear-1]
		if release := oldestCounted.CreatedAt.Add(oneYear); release.After(next) {
			next = release
		}
	}
	if next.After(now) {
		window.NextChangeAvailableAt = &next
	}
	return window, nil
}
