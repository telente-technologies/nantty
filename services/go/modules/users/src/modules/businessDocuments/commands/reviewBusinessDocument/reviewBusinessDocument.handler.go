package reviewbusinessdocument

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/businessdocument"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
	businessevents "nantty/modules/users/src/modules/businessDocuments/events"
	"nantty/modules/users/src/modules/businessDocuments/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.SubmissionView, error) {
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return services.SubmissionView{}, err
	}
	owner, ownerErr := uuid.Parse(command.AccountId)
	documentId, documentErr := uuid.Parse(command.DocumentId)
	if ownerErr != nil || documentErr != nil {
		return services.SubmissionView{}, usersErrors.NotFound("That document was not found.")
	}
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		document, err := tx.BusinessDocument.Query().Where(businessdocument.ID(documentId), businessdocument.AccountID(owner), businessdocument.IsCurrent(true), businessdocument.IsUploaded(true)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return usersErrors.NotFound("That document was not found.")
		}
		if err != nil {
			return err
		}
		revoking := !command.Approve && document.Status == businessdocument.StatusApproved
		if document.Status != businessdocument.StatusPending && !revoking {
			return usersErrors.Conflict("ALREADY_DECIDED", "This document was already reviewed.")
		}
		wasVerified := false
		if !command.Approve {
			if wasVerified, err = services.EveryKindApprovedOnce(ctx, tx.Client(), owner); err != nil {
				return err
			}
		}
		status, action := businessdocument.StatusRejected, "business_document.rejected"
		if command.Approve {
			status, action = businessdocument.StatusApproved, "business_document.approved"
		}
		now := handler.Container.Now()
		update := document.Update().SetStatus(status).SetReviewedByName(command.Actor.Name).SetReviewedAt(now)
		if !command.Approve {
			update.SetRejectionReason(reason)
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, businessevents.BusinessDocumentReviewedType, owner.String(), now, businessevents.DocumentEventData{
			AccountId: owner.String(), DocumentId: document.ID.String(), Kind: string(document.Kind), Status: string(status), Reason: reason,
		}); err != nil {
			return err
		}
		label := services.DocumentKindLabels[string(document.Kind)]
		if !command.Approve {
			if err := services.EnqueueSellerDocumentsNoticeInTransaction(ctx, tx, now, "sellerDocuments.rejected", owner, services.SellerDocumentsNotice{Documents: []string{label}, Issues: []string{reason}}); err != nil {
				return err
			}
		}
		if wasVerified {
			if err := services.EnqueueVerificationRevokedInTransaction(ctx, tx, now, owner, string(document.Kind), reason); err != nil {
				return err
			}
		}
		if command.Approve {
			if allApproved, err := services.AllDocumentsApproved(ctx, tx.Client(), owner); err != nil {
				return err
			} else if allApproved {
				if err := services.EnqueueSellerDocumentsNoticeInTransaction(ctx, tx, now, "sellerDocuments.approved", owner, services.SellerDocumentsNotice{Documents: []string{"CAC certificate", "Government ID", "Proof of address"}}); err != nil {
					return err
				}
			}
			if err := services.EvaluateGoldFromApprovedDocuments(ctx, handler.Container, tx, owner); err != nil {
				return err
			}
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: action, SubjectType: "business_document", SubjectId: document.ID.String(), SubjectLabel: string(document.Kind), Reason: reason,
			Before: map[string]any{"status": document.Status}, After: map[string]any{"status": status, "accountId": owner},
		})
	})
	if err != nil {
		return services.SubmissionView{}, err
	}
	return services.BuildSubmissionView(ctx, handler.Container, owner)
}
