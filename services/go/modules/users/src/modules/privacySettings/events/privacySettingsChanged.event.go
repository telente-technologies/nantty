package events

const PrivacySettingsChangedType = "privacy.settingsChanged"

type PrivacySettingsChangedData struct {
	AccountId       string `json:"accountId"`
	Personalization bool   `json:"personalization"`
	PersonalizedAds bool   `json:"personalizedAds"`
	Marketing       bool   `json:"marketing"`
	Analytics       bool   `json:"analytics"`
	ChangedAt       string `json:"changedAt"`
	PolicyVersion   string `json:"policyVersion"`
}
