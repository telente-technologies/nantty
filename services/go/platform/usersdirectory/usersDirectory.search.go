package usersdirectory

import (
	"context"
	"strings"

	"github.com/google/uuid"
)

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func (reader Reader) SearchActivePersonalProfiles(ctx context.Context, text string, excluded []uuid.UUID, limit int) ([]ProfileName, error) {
	text = strings.TrimPrefix(strings.TrimSpace(text), "@")
	if text == "" || limit <= 0 {
		return []ProfileName{}, nil
	}
	if excluded == nil {
		excluded = []uuid.UUID{}
	}
	prefix := likeEscaper.Replace(strings.ToLower(text)) + "%"
	contains := "%" + likeEscaper.Replace(strings.ToLower(text)) + "%"
	rows, err := reader.Database.QueryContext(ctx,
		"SELECT id, account_id, handle, display_name, COALESCE(avatar_url, ''), verified FROM "+reader.table("profiles")+
			" WHERE kind = 'personal' AND status = 'active' AND NOT (account_id = ANY($3)) AND (lower(handle) LIKE $1 OR lower(display_name) LIKE $2)"+
			" ORDER BY (lower(handle) LIKE $1) DESC, handle LIMIT $4", prefix, contains, excluded, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	profiles := []ProfileName{}
	for rows.Next() {
		var profile ProfileName
		if err := rows.Scan(&profile.ProfileId, &profile.AccountId, &profile.Handle, &profile.Name, &profile.AvatarUrl, &profile.Verified); err != nil {
			return nil, err
		}
		if profile.Name == "" {
			profile.Name = profile.Handle
		}
		profiles = append(profiles, profile)
	}
	return profiles, rows.Err()
}

func (reader Reader) ActivePersonalProfileExists(ctx context.Context, accountId uuid.UUID) (ProfileName, bool, error) {
	profiles, err := reader.PersonalProfilesByAccount(ctx, []uuid.UUID{accountId})
	if err != nil {
		return ProfileName{}, false, err
	}
	profile, found := profiles[accountId]
	if !found {
		return ProfileName{}, false, nil
	}
	var status string
	if err := reader.Database.QueryRowContext(ctx, "SELECT status FROM "+reader.table("profiles")+" WHERE id = $1", profile.ProfileId).Scan(&status); err != nil {
		return ProfileName{}, false, err
	}
	return profile, status == "active", nil
}
