package events

const PolicyVersionPublishedType = "policyVersion.published"

type PolicyVersionPublishedNotice struct {
	Kind             string   `json:"kind"`
	Version          string   `json:"version"`
	EffectiveAt      string   `json:"effectiveAt"`
	PublishedBy      string   `json:"publishedBy"`
	VersionId        string   `json:"versionId"`
	DocumentKey      string   `json:"documentKey"`
	DocumentTitle    string   `json:"documentTitle"`
	ChangeSummary    string   `json:"changeSummary"`
	WhatChanged      []string `json:"whatChanged"`
	IsMaterialChange bool     `json:"isMaterialChange"`
}

const (
	PolicyPublishedType          = "policy.published"
	LegalNoticeQueuedType        = "legalNotice.queued"
	LegalNoticeTestRequestedType = "legalNotice.testRequested"
)

type EmailDraft struct {
	Subject      string   `json:"subject"`
	SummaryText  string   `json:"summaryText"`
	WhatChanged  []string `json:"whatChanged"`
	ReacceptNote string   `json:"reacceptNote"`
	DocumentUrl  string   `json:"documentUrl"`
	EffectiveAt  string   `json:"effectiveAt"`
}

type PolicyPublishedData struct {
	PolicyVersionId  string      `json:"policyVersionId"`
	DocumentKey      string      `json:"documentKey"`
	DocumentTitle    string      `json:"documentTitle"`
	VersionNumber    int         `json:"versionNumber"`
	IsMaterialChange bool        `json:"isMaterialChange"`
	EffectiveAt      string      `json:"effectiveAt"`
	NoticeId         *string     `json:"noticeId"`
	Recipients       string      `json:"recipients"`
	Email            *EmailDraft `json:"email"`
}

type TestRequestedData struct {
	VersionId string     `json:"versionId"`
	StaffId   string     `json:"staffId"`
	Email     EmailDraft `json:"email"`
}
