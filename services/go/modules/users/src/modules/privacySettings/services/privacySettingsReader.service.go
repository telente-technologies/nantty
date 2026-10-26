package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/privacysetting"
	"nantty/modules/users/src/modules/privacySettings/models"
)

func ReadPrivacySettings(ctx context.Context, client *ent.Client, accountId uuid.UUID) (models.PrivacySettings, error) {
	row, err := client.PrivacySetting.Query().Where(privacysetting.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return models.PrivacySettings{Essential: true}, nil
	}
	if err != nil {
		return models.PrivacySettings{}, err
	}
	updatedAt := row.UpdatedAt
	return models.PrivacySettings{
		Essential: true, Analytics: row.Analytics, Personalization: row.Personalization, PersonalizedAds: row.PersonalizedAds,
		Marketing: row.Marketing, PolicyVersion: row.PolicyVersion, UpdatedAt: &updatedAt,
	}, nil
}
