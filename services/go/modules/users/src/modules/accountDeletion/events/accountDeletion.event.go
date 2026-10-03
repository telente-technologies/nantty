package events

import retentionmodels "zudomart/modules/users/src/modules/retention/models"

const (
	AccountDeletionRequestedType = "account.deletionRequested"
	AccountDeletionCancelledType = "account.deletionCancelled"
	AccountDeletionExecutedType  = "account.deletionExecuted"
)

type AccountDeletionRequestedData struct {
	AccountId       string                           `json:"accountId"`
	RequestedAt     string                           `json:"requestedAt"`
	ScheduledFor    string                           `json:"scheduledFor"`
	RetentionPolicy []retentionmodels.PolicySnapshot `json:"retentionPolicy"`
}

type AccountDeletionCancelledData struct {
	AccountId   string `json:"accountId"`
	CancelledAt string `json:"cancelledAt"`
}

type AccountDeletionExecutedData struct {
	AccountId       string                           `json:"accountId"`
	ExecutedAt      string                           `json:"executedAt"`
	RetentionPolicy []retentionmodels.PolicySnapshot `json:"retentionPolicy"`
	AppliedSteps    []AppliedStep                    `json:"appliedSteps"`
	FinalEmail      string                           `json:"finalEmail,omitempty"`
	ReferenceId     string                           `json:"referenceId,omitempty"`
}

type AppliedStep struct {
	Category string `json:"category"`
	Outcome  string `json:"outcome"`
}
