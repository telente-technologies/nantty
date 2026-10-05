package models

import (
	"time"

	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/types"
)

type PasskeyView struct {
	Id         string  `json:"id"`
	Label      string  `json:"label"`
	CreatedAt  string  `json:"createdAt"`
	LastUsedAt *string `json:"lastUsedAt"`
}

type PreferencesView struct {
	Theme string `json:"theme"`
}

type OwnAccountView struct {
	Account                types.StaffView `json:"account"`
	RecoveryCodesRemaining int             `json:"recoveryCodesRemaining"`
	Passkeys               []PasskeyView   `json:"passkeys"`
	Preferences            PreferencesView `json:"preferences"`
}

type SessionView struct {
	Id         string `json:"id"`
	IpAddress  string `json:"ipAddress"`
	UserAgent  string `json:"userAgent"`
	StartedAt  string `json:"startedAt"`
	LastSeenAt string `json:"lastSeenAt"`
	IsCurrent  bool   `json:"isCurrent"`
}

type RecoveryCodesResult struct {
	RecoveryCodes []string `json:"recoveryCodes"`
}

func ConvertPasskeyToView(row *ent.StaffWebauthnCredential) PasskeyView {
	view := PasskeyView{Id: row.ID.String(), Label: row.Label, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339)}
	if row.LastUsedAt != nil {
		formatted := row.LastUsedAt.UTC().Format(time.RFC3339)
		view.LastUsedAt = &formatted
	}
	return view
}

func ConvertSessionToView(row *ent.StaffSession, currentSessionId string) SessionView {
	return SessionView{
		Id: row.ID.String(), IpAddress: row.IPAddress, UserAgent: row.UserAgent, StartedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		LastSeenAt: row.LastUsedAt.UTC().Format(time.RFC3339), IsCurrent: row.ID.String() == currentSessionId,
	}
}
