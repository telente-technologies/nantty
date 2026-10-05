package interfaces

import (
	"context"

	"github.com/google/uuid"

	"zudomart/platform/usersdirectory"
)

type UserDirectory interface {
	PersonalProfilesByAccount(ctx context.Context, accountIds []uuid.UUID) (map[uuid.UUID]usersdirectory.ProfileName, error)
	FindBusinessProfile(ctx context.Context, profileId uuid.UUID) (usersdirectory.BusinessProfile, bool, error)
	SearchActivePersonalProfiles(ctx context.Context, text string, excluded []uuid.UUID, limit int) ([]usersdirectory.ProfileName, error)
	ActivePersonalProfileExists(ctx context.Context, accountId uuid.UUID) (usersdirectory.ProfileName, bool, error)
	AccountsAllowingPersonalizedAds(ctx context.Context, accountIds []uuid.UUID) ([]uuid.UUID, error)
	PersonalProfileCountry(ctx context.Context, accountId uuid.UUID) (string, error)
	PrivacyChoicesOf(ctx context.Context, accountId uuid.UUID) (usersdirectory.PrivacyChoices, bool, error)
}
