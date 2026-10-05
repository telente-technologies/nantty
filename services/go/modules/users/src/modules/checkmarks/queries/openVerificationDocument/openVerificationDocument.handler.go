package openverificationdocument

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/integrations"
	"zudomart/modules/users/src/modules/checkmarks/services"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
)

const viewLinkTimeToLive = 2 * time.Minute

type Result struct {
	DocumentId    string `json:"documentId"`
	Kind          string `json:"kind"`
	Label         string `json:"label"`
	ViewUrl       string `json:"viewUrl"`
	ExpiresAt     string `json:"expiresAt"`
	WatermarkText string `json:"watermarkText"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, actor types.StaffActor, rawVerificationId, documentId string) (Result, error) {
	verificationId, err := uuid.Parse(rawVerificationId)
	if err != nil {
		return Result{}, usersErrors.NotFound("That document was not found.")
	}
	row, err := handler.Container.Client.VerificationApplication.Get(ctx, verificationId)
	if ent.IsNotFound(err) {
		return Result{}, usersErrors.NotFound("That document was not found.")
	}
	if err != nil {
		return Result{}, err
	}
	for _, document := range services.VerificationDocumentsOf(row) {
		if document.Id == documentId {
			return handler.open(ctx, actor, row, document)
		}
	}
	return Result{}, usersErrors.NotFound("That document was not found.")
}

func (handler Handler) open(ctx context.Context, actor types.StaffActor, row *ent.VerificationApplication, document services.VerificationDocument) (Result, error) {
	url := document.StorageKey()
	if !strings.HasPrefix(url, "https://") {
		storage, err := integrations.DocumentStorageFor(ctx, handler.Container.Settings.Privacy)
		if err != nil {
			return Result{}, err
		}
		if url, err = storage.PresignView(ctx, document.StorageKey(), viewLinkTimeToLive); err != nil {
			return Result{}, err
		}
	}
	now := handler.Container.Now()
	err := usersservices.RecordStaffAuditEntry(ctx, actor, usersservices.StaffAuditEntry{
		Action: "verification.document_viewed", SubjectType: "verification", SubjectId: row.ID.String(), SubjectLabel: document.Label, Reason: "document opened for review",
		After: map[string]any{"documentId": document.Id},
	})
	return Result{
		DocumentId: document.Id, Kind: document.Kind, Label: document.Label, ViewUrl: url, ExpiresAt: now.Add(viewLinkTimeToLive).UTC().Format(time.RFC3339),
		WatermarkText: "Zudomart Admin — confidential · " + actor.Name + " · " + now.UTC().Format(time.RFC3339),
	}, err
}
