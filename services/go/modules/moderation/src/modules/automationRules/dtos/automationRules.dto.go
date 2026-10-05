package dtos

import (
	"encoding/json"

	"zudomart/modules/moderation/src/modules/automationRules/services"
)

type VersionAuthor struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type VersionedRecord struct {
	Id           string               `json:"id"`
	Version      int                  `json:"version"`
	UpdatedAt    string               `json:"updatedAt"`
	UpdatedBy    VersionAuthor        `json:"updatedBy"`
	ChangeReason string               `json:"changeReason"`
	IsArchived   bool                 `json:"isArchived"`
	Content      services.RuleContent `json:"content"`
}

type SaveRuleRequest struct {
	ExpectedVersion *int            `json:"expectedVersion"`
	Reason          string          `json:"reason"`
	Content         json.RawMessage `json:"content"`
}

type VersionWriteRequest struct {
	ExpectedVersion *int   `json:"expectedVersion"`
	Reason          string `json:"reason"`
}

type Execution struct {
	Id           string          `json:"id"`
	RuleId       string          `json:"ruleId"`
	RuleVersion  int             `json:"ruleVersion"`
	RuleName     string          `json:"ruleName"`
	Event        string          `json:"event"`
	SubjectLabel string          `json:"subjectLabel"`
	OccurredAt   string          `json:"occurredAt"`
	Outcome      string          `json:"outcome"`
	Status       string          `json:"status"`
	ActionsRun   []string        `json:"actionsRun"`
	ErrorMessage *string         `json:"errorMessage"`
	Steps        json.RawMessage `json:"steps"`
}

type Items[Item any] struct {
	Items []Item `json:"items"`
}
