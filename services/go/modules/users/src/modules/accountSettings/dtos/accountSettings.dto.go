package dtos

type UpdateSettingsRequest struct {
	Email                    *string `json:"email"`
	Theme                    *string `json:"theme"`
	Language                 *string `json:"language"`
	CountryCode              *string `json:"countryCode"`
	PushNotificationsEnabled *bool   `json:"pushNotificationsEnabled"`
	TwoFactorEnabled         *bool   `json:"twoFactorEnabled"`
}

type MarketingPreferencesRequest struct {
	Frequency string `json:"frequency"`
}
