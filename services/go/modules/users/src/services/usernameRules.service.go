package services

import (
	"context"
	"encoding/json"
	"time"

	"zudomart/modules/users/src/container"
)

const UsernameRulesSettingKey = "username-rules"

type UsernameRules struct {
	ChangesAllowedPerWindow int
	ChangeWindow            time.Duration
	MaximumChangesPerYear   int
	Quarantine              time.Duration
}

func LoadUsernameRules(ctx context.Context, application *container.Container) UsernameRules {
	settings := application.Settings
	rules := UsernameRules{ChangesAllowedPerWindow: 1, ChangeWindow: settings.UsernameChangeCooldown, MaximumChangesPerYear: settings.UsernameMaximumChangesYear, Quarantine: settings.UsernameQuarantine}
	raw, found := application.PlatformSettings.ReadValue(ctx, UsernameRulesSettingKey)
	if !found {
		return rules
	}
	var stored struct {
		ChangesAllowedPerWindow      *int `json:"changesAllowedPerWindow"`
		ChangeWindowDays             *int `json:"changeWindowDays"`
		ReleasedUsernameCooldownDays *int `json:"releasedUsernameCooldownDays"`
	}
	if err := json.Unmarshal(raw, &stored); err != nil {
		application.Logger.WarnContext(ctx, "username rules setting unreadable, using the environment values", "error", err.Error())
		return rules
	}
	if stored.ChangesAllowedPerWindow != nil && *stored.ChangesAllowedPerWindow >= 0 {
		rules.ChangesAllowedPerWindow = *stored.ChangesAllowedPerWindow
	}
	if stored.ChangeWindowDays != nil && *stored.ChangeWindowDays >= 1 {
		rules.ChangeWindow = time.Duration(*stored.ChangeWindowDays) * 24 * time.Hour
	}
	if stored.ReleasedUsernameCooldownDays != nil && *stored.ReleasedUsernameCooldownDays >= 0 {
		rules.Quarantine = time.Duration(*stored.ReleasedUsernameCooldownDays) * 24 * time.Hour
	}
	return rules
}
