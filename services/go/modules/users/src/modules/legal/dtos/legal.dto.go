package dtos

type VersionRequest struct {
	BodyMarkdown     string `json:"bodyMarkdown"`
	ChangeSummary    string `json:"changeSummary"`
	EffectiveAt      string `json:"effectiveAt"`
	IsMaterialChange bool   `json:"isMaterialChange"`
}

type ReasonRequest struct {
	Reason string `json:"reason"`
}

type PublishRequest struct {
	Reason                 string `json:"reason"`
	AcknowledgeShortNotice bool   `json:"acknowledgeShortNotice"`
}

type RollbackRequest struct {
	FromVersionId string `json:"fromVersionId"`
	Reason        string `json:"reason"`
}

type NoticeDraftRequest struct {
	Subject      string   `json:"subject"`
	SummaryText  string   `json:"summaryText"`
	WhatChanged  []string `json:"whatChanged"`
	ReacceptNote string   `json:"reacceptNote"`
}

type QueueNoticeRequest struct {
	VersionId string `json:"versionId"`
	Reason    string `json:"reason"`
}

type NoticeProgressRequest struct {
	Status              string `json:"status"`
	SentCount           int    `json:"sentCount"`
	ExcludedHardBounces int    `json:"excludedHardBounces"`
	ExcludedSuppressed  int    `json:"excludedSuppressed"`
	BatchesDone         int    `json:"batchesDone"`
}
