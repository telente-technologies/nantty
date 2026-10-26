package openbusinessdocument

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/businessdocument"
	"nantty/modules/users/src/integrations"
	usersservices "nantty/modules/users/src/services"
	"nantty/modules/users/src/types"
)

const viewLinkTimeToLive = 2 * time.Minute

type Result struct {
	DocumentId    string `json:"documentId"`
	FileName      string `json:"fileName"`
	ViewUrl       string `json:"viewUrl"`
	ExpiresAt     string `json:"expiresAt"`
	WatermarkText string `json:"watermarkText"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, actor types.StaffActor, rawAccountId, rawDocumentId string) (Result, error) {
	owner, ownerErr := uuid.Parse(rawAccountId)
	documentId, documentErr := uuid.Parse(rawDocumentId)
	if ownerErr != nil || documentErr != nil {
		return Result{}, usersErrors.NotFound("That document was not found.")
	}
	document, err := handler.Container.Client.BusinessDocument.Query().Where(businessdocument.ID(documentId), businessdocument.AccountID(owner), businessdocument.IsUploaded(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return Result{}, usersErrors.NotFound("That document was not found.")
	}
	if err != nil {
		return Result{}, err
	}
	storage, err := integrations.DocumentStorageFor(ctx, handler.Container.Settings.Privacy)
	if err != nil {
		return Result{}, err
	}
	url, err := storage.PresignView(ctx, document.ObjectKey, viewLinkTimeToLive)
	if err != nil {
		return Result{}, err
	}
	now := handler.Container.Now()
	err = usersservices.RecordStaffAuditEntry(ctx, actor, usersservices.StaffAuditEntry{
		Action: "business_document.viewed", SubjectType: "business_document", SubjectId: document.ID.String(), SubjectLabel: string(document.Kind), Reason: "document opened for review",
	})
	return Result{DocumentId: document.ID.String(), FileName: document.FileName, ViewUrl: url, ExpiresAt: now.Add(viewLinkTimeToLive).UTC().Format(time.RFC3339),
		WatermarkText: "Zudomart Admin — confidential · " + actor.Name + " · " + now.UTC().Format(time.RFC3339)}, err
}
