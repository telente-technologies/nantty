package getmybusinessdocuments

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/integrations"
	"nantty/modules/users/src/modules/businessDocuments/services"
)

type Document struct {
	Kind            string  `json:"kind"`
	Label           string  `json:"label"`
	Status          string  `json:"status"`
	FileUrl         *string `json:"fileUrl"`
	RejectionReason *string `json:"rejectionReason"`
	SubmittedAt     *string `json:"submittedAt"`
}

type Result struct {
	Documents   []Document `json:"documents"`
	AllApproved bool       `json:"allApproved"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId string) (Result, error) {
	owner, err := uuid.Parse(accountId)
	if err != nil {
		return Result{}, usersErrors.ErrAccountUnavailable
	}
	rows, err := services.CurrentDocuments(ctx, handler.Container.Client, owner, true)
	if err != nil {
		return Result{}, err
	}
	storage, storageErr := integrations.DocumentStorageFor(ctx, handler.Container.Settings.Privacy)
	result := Result{Documents: []Document{}, AllApproved: true}
	for _, kind := range services.DocumentKindOrder {
		document := Document{Kind: kind, Label: services.DocumentKindLabels[kind], Status: "not_uploaded"}
		for _, row := range rows {
			if string(row.Kind) != kind {
				continue
			}
			document.Status = string(row.Status)
			submitted := row.CreatedAt.UTC().Format(time.RFC3339)
			document.SubmittedAt = &submitted
			if row.RejectionReason != "" {
				document.RejectionReason = &row.RejectionReason
			}
			if storageErr == nil {
				if url, err := storage.PresignView(ctx, row.ObjectKey, 5*time.Minute); err == nil {
					document.FileUrl = &url
				}
			}
		}
		result.AllApproved = result.AllApproved && document.Status == "approved"
		result.Documents = append(result.Documents, document)
	}
	return result, nil
}
