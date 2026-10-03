package models

type UsernameChangeView struct {
	From      string `json:"from"`
	To        string `json:"to"`
	ChangedAt string `json:"changedAt"`
	Reason    string `json:"reason"`
}

type UsernamePolicyView struct {
	Username                 string               `json:"username"`
	CanChangeNow             bool                 `json:"canChangeNow"`
	NextChangeAvailableAt    *string              `json:"nextChangeAvailableAt"`
	ChangesRemainingThisYear int                  `json:"changesRemainingThisYear"`
	CooldownDays             int                  `json:"cooldownDays"`
	MaxChangesPerYear        int                  `json:"maxChangesPerYear"`
	QuarantineDays           int                  `json:"quarantineDays"`
	Rules                    []string             `json:"rules"`
	History                  []UsernameChangeView `json:"history"`
}
