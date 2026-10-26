package dtos

import (
	"time"

	"nantty/modules/users/src/modules/privacySettings/models"
)

type UpdatePrivacySettingsRequest struct {
	Personalization *bool   `json:"personalization"`
	PersonalizedAds *bool   `json:"personalizedAds"`
	Marketing       *bool   `json:"marketing"`
	Analytics       *bool   `json:"analytics"`
	PolicyVersion   *string `json:"policyVersion"`
}

type PrivacySettingsResponse struct {
	Essential       bool    `json:"essential"`
	Personalization bool    `json:"personalization"`
	PersonalizedAds bool    `json:"personalizedAds"`
	Marketing       bool    `json:"marketing"`
	Analytics       bool    `json:"analytics"`
	PolicyVersion   string  `json:"policyVersion"`
	UpdatedAt       *string `json:"updatedAt"`
}

func ConvertSettingsToResponse(settings models.PrivacySettings) PrivacySettingsResponse {
	response := PrivacySettingsResponse{
		Essential: true, Personalization: settings.Personalization, PersonalizedAds: settings.PersonalizedAds,
		Marketing: settings.Marketing, Analytics: settings.Analytics, PolicyVersion: settings.PolicyVersion,
	}
	if settings.UpdatedAt != nil {
		formatted := settings.UpdatedAt.UTC().Format(time.RFC3339)
		response.UpdatedAt = &formatted
	}
	return response
}
