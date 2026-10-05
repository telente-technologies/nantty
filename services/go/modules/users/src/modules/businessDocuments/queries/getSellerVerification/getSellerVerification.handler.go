package getsellerverification

import (
	"context"

	"zudomart/modules/users/src/container"
	getmybusinessdocuments "zudomart/modules/users/src/modules/businessDocuments/queries/getMyBusinessDocuments"
)

type DocumentStatus struct {
	Kind   string `json:"kind"`
	Label  string `json:"label"`
	Status string `json:"status"`
}

type Result struct {
	Status      string           `json:"status"`
	Note        *string          `json:"note"`
	SubmittedAt *string          `json:"submittedAt"`
	Documents   []DocumentStatus `json:"documents"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId string) (Result, error) {
	current, err := getmybusinessdocuments.Handler{Container: handler.Container}.Execute(ctx, accountId)
	if err != nil {
		return Result{}, err
	}
	return Summarise(current), nil
}

func Summarise(current getmybusinessdocuments.Result) Result {
	result := Result{Status: "unverified", Documents: []DocumentStatus{}}
	submitted, approved := 0, 0
	for _, document := range current.Documents {
		status := map[string]string{"not_uploaded": "missing", "pending": "in_review", "approved": "approved", "rejected": "rejected"}[document.Status]
		if status == "" {
			status = "in_review"
		}
		result.Documents = append(result.Documents, DocumentStatus{Kind: document.Kind, Label: document.Label, Status: status})
		if status != "missing" {
			submitted++
		}
		if status == "approved" {
			approved++
		}
		if status == "rejected" && result.Note == nil {
			result.Note = document.RejectionReason
		}
		if document.SubmittedAt != nil && (result.SubmittedAt == nil || *document.SubmittedAt < *result.SubmittedAt) {
			result.SubmittedAt = document.SubmittedAt
		}
	}
	switch {
	case len(result.Documents) > 0 && approved == len(result.Documents):
		result.Status = "verified"
	case submitted > 0:
		result.Status = "pending"
	}
	return result
}
