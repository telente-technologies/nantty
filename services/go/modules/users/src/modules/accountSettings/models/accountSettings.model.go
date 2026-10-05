package models

type AccountSettings struct {
	Email                    string  `json:"email"`
	Phone                    *string `json:"phone"`
	Theme                    string  `json:"theme"`
	Language                 string  `json:"language"`
	CountryCode              *string `json:"countryCode"`
	PushNotificationsEnabled bool    `json:"pushNotificationsEnabled"`
	TwoFactorEnabled         bool    `json:"twoFactorEnabled"`
}

type MarketingPreferences struct {
	Frequency string `json:"frequency"`
}
