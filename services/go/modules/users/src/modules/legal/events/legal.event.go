package events

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
