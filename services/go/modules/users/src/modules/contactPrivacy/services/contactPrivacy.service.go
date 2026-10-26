package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/privacysetting"
	"nantty/modules/users/src/generated/ent/profile"
)

type ContactPrivacy struct {
	WhoCanMessageMe  string `json:"whoCanMessageMe"`
	WhoCanMentionMe  string `json:"whoCanMentionMe"`
	IsPrivateProfile bool   `json:"isPrivateProfile"`
}

func LoadContactPrivacy(ctx context.Context, client *ent.Client, accountId uuid.UUID) (ContactPrivacy, error) {
	result := ContactPrivacy{WhoCanMessageMe: "everyone", WhoCanMentionMe: "everyone"}
	row, err := client.PrivacySetting.Query().Where(privacysetting.AccountID(accountId)).Only(ctx)
	if err == nil {
		result.WhoCanMessageMe, result.WhoCanMentionMe = string(row.WhoCanMessageMe), string(row.WhoCanMentionMe)
	} else if !ent.IsNotFound(err) {
		return result, err
	}
	personal, err := client.Profile.Query().Where(profile.AccountID(accountId), profile.KindEQ(profile.KindPersonal)).Only(ctx)
	if err == nil {
		result.IsPrivateProfile = personal.IsPrivate
	} else if !ent.IsNotFound(err) {
		return result, err
	}
	return result, nil
}
