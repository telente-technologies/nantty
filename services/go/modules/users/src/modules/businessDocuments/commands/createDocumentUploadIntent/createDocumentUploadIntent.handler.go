package createdocumentuploadintent

import (
	"context"
	"path"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent/businessdocument"
	"nantty/modules/users/src/integrations"
	"nantty/modules/users/src/modules/businessDocuments/services"
)

const uploadIntentTimeToLive = 10 * time.Minute

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return Result{}, usersErrors.ErrAccountUnavailable
	}
	if _, known := services.DocumentKindLabels[command.Kind]; !known {
		return Result{}, usersErrors.NotFound("That document type does not exist.")
	}
	extension, allowed := services.ExtensionForContentType(command.ContentType)
	if !allowed || command.SizeBytes <= 0 || command.SizeBytes > services.MaximumDocumentBytes {
		return Result{}, usersErrors.ValidationFailedFor("contentType", "must be a PDF, JPEG, PNG or WebP file of at most 10 MB")
	}
	fileName := path.Base(strings.TrimSpace(command.FileName))
	if fileName == "." || fileName == "/" || len(fileName) > 200 {
		return Result{}, usersErrors.ValidationFailedFor("fileName", "is required")
	}
	if approved, err := handler.Container.Client.BusinessDocument.Query().Where(businessdocument.AccountID(owner), businessdocument.KindEQ(businessdocument.Kind(command.Kind)), businessdocument.IsCurrent(true), businessdocument.StatusEQ(businessdocument.StatusApproved)).Exist(ctx); err != nil || approved {
		return Result{}, usersErrors.OrConflict(err, "ALREADY_APPROVED", "This document was already approved.")
	}
	storage, err := integrations.DocumentStorageFor(ctx, handler.Container.Settings.Privacy)
	if err != nil {
		return Result{}, err
	}
	objectKey := "business-documents/" + owner.String() + "/" + command.Kind + "/" + uuid.NewString() + "." + extension
	ticket, err := storage.PresignUpload(ctx, objectKey, command.ContentType, command.SizeBytes, uploadIntentTimeToLive)
	if err != nil {
		return Result{}, err
	}
	create := handler.Container.Client.BusinessDocument.Create().SetAccountID(owner).SetKind(businessdocument.Kind(command.Kind)).SetObjectKey(objectKey).SetFileName(fileName).SetContentType(command.ContentType).SetSizeBytes(command.SizeBytes).SetIsCurrent(false)
	if store, err := services.StoreProfileOf(ctx, handler.Container.Client, owner); err == nil && store != nil {
		create.SetProfileID(store.ID)
	}
	created, err := create.Save(ctx)
	if err != nil {
		return Result{}, err
	}
	return Result{DocumentId: created.ID.String(), ObjectKey: objectKey, UploadUrl: ticket.Url, Headers: ticket.Headers, ExpiresAt: handler.Container.Now().Add(uploadIntentTimeToLive).UTC().Format(time.RFC3339)}, nil
}
