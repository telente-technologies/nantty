package confirmbusinessdocumentupload

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/businessdocument"
	"nantty/modules/users/src/integrations"
	businessevents "nantty/modules/users/src/modules/businessDocuments/events"
	"nantty/modules/users/src/modules/businessDocuments/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return usersErrors.ErrAccountUnavailable
	}
	storage, err := integrations.DocumentStorageFor(ctx, handler.Container.Settings.Privacy)
	if err != nil {
		return err
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		intent, err := handler.findIntent(ctx, tx, owner, command)
		if err != nil {
			return err
		}
		if exists, err := storage.Exists(ctx, intent.ObjectKey); err != nil || !exists {
			return usersErrors.OrConflict(err, "UPLOAD_MISSING", "The file has not been uploaded yet.")
		}
		if _, err := tx.BusinessDocument.Update().Where(businessdocument.AccountID(owner), businessdocument.KindEQ(intent.Kind), businessdocument.IsCurrent(true)).SetIsCurrent(false).Save(ctx); err != nil {
			return err
		}
		if err := intent.Update().SetIsUploaded(true).SetIsCurrent(true).SetStatus(businessdocument.StatusPending).Exec(ctx); err != nil {
			return err
		}
		if err := services.EnqueueSellerDocumentsNoticeInTransaction(ctx, tx, handler.Container.Now(), "sellerDocuments.submitted", owner, services.SellerDocumentsNotice{Documents: []string{services.DocumentKindLabels[string(intent.Kind)]}, ReviewWithinDays: 2}); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, businessevents.BusinessDocumentSubmittedType, owner.String(), handler.Container.Now(), businessevents.DocumentEventData{
			AccountId: owner.String(), DocumentId: intent.ID.String(), Kind: string(intent.Kind),
		})
	})
}

func (handler Handler) findIntent(ctx context.Context, tx *ent.Tx, owner uuid.UUID, command Command) (*ent.BusinessDocument, error) {
	query := tx.BusinessDocument.Query().Where(businessdocument.AccountID(owner), businessdocument.KindEQ(businessdocument.Kind(command.Kind)), businessdocument.IsUploaded(false))
	if command.DocumentId != "" {
		documentId, err := uuid.Parse(command.DocumentId)
		if err != nil {
			return nil, usersErrors.NotFound("That upload was not found.")
		}
		query = query.Where(businessdocument.ID(documentId))
	}
	candidates, err := query.Order(ent.Desc(businessdocument.FieldID)).Limit(10).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, candidate := range candidates {
		if command.DocumentId != "" || command.FileUrl == "" || strings.Contains(command.FileUrl, candidate.ObjectKey) {
			return candidate, nil
		}
	}
	return nil, usersErrors.NotFound("Request an upload link first.")
}
