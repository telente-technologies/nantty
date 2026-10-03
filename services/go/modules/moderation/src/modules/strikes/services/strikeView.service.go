package services

import (
	"time"

	"zudomart/modules/moderation/src/generated/ent"
)

type StrikeView struct {
	Id           string  `json:"id"`
	Kind         string  `json:"kind"`
	Policy       string  `json:"policy"`
	Reason       string  `json:"reason"`
	Source       string  `json:"source"`
	IssuedAt     string  `json:"issuedAt"`
	ExpiresAt    *string `json:"expiresAt"`
	IssuedByName string  `json:"issuedByName"`
	Status       string  `json:"status"`
}

func BuildStrikeView(row *ent.Strike, now time.Time) StrikeView {
	view := StrikeView{Id: row.ID.String(), Kind: string(row.Kind), Policy: row.Policy, Reason: row.Reason, Source: AdminSource(string(row.Source)), IssuedAt: row.CreatedAt.UTC().Format(time.RFC3339), IssuedByName: row.IssuedByName, Status: StatusAt(row, now)}
	if row.ExpiresAt != nil {
		expiry := row.ExpiresAt.UTC().Format(time.RFC3339)
		view.ExpiresAt = &expiry
	}
	return view
}
