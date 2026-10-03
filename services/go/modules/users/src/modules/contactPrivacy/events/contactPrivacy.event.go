package events

const ContactPrivacyChangedType = "privacy.contactSettingsChanged"

type ContactPrivacyChangedData struct {
	AccountId     string `json:"accountId"`
	WhoCanMessage string `json:"whoCanMessageMe"`
	WhoCanMention string `json:"whoCanMentionMe"`
}
