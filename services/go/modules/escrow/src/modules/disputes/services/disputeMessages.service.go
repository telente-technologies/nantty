package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"slices"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/dispute"
	"nantty/modules/escrow/src/generated/ent/disputemessage"
	"nantty/modules/escrow/src/generated/ent/escrow"
)

type DisputeMessageInput struct {
	DisputeId      uuid.UUID
	AuthorUserId   string
	AsSupport      bool
	StoreId        string
	Text           string
	AttachmentUrls []string
}

func ParticipantRole(found *ent.Escrow, userId string) (string, bool) {
	switch userId {
	case found.BuyerUserID:
		return "buyer", true
	case found.SellerUserID:
		return "seller", true
	}
	return "", false
}

func (service DisputeService) AddDisputeMessageInTransaction(ctx context.Context, transaction *sql.Tx, input DisputeMessageInput) (*ent.DisputeMessage, error) {
	container := service.Escrows.Container
	client := container.Client(transaction)
	locked, err := client.Dispute.Query().Where(dispute.ID(input.DisputeId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrDisputeNotFound
	}
	if err != nil {
		return nil, err
	}
	held, err := client.Escrow.Query().Where(escrow.ID(locked.EscrowID)).Only(ctx)
	if err != nil {
		return nil, err
	}
	role := "support"
	if input.StoreId != "" {
		if held.StoreID != input.StoreId {
			return nil, ErrDisputeNotFound
		}
		role = "seller"
	} else if !input.AsSupport {
		participantRole, isParticipant := ParticipantRole(held, input.AuthorUserId)
		if !isParticipant {
			return nil, ErrDisputeNotFound
		}
		role = participantRole
	}
	if !slices.Contains(activeDisputeStatuses, locked.Status) {
		return nil, ErrDisputeClosed
	}
	attachments, _ := json.Marshal(nonNilStrings(input.AttachmentUrls))
	message, err := client.DisputeMessage.Create().SetDisputeID(locked.ID).SetAuthorUserID(input.AuthorUserId).
		SetAuthorRole(disputemessage.AuthorRole(role)).SetText(input.Text).SetAttachmentUrls(attachments).
		SetCreatedAt(container.Now().UTC()).Save(ctx)
	if err != nil {
		return nil, err
	}
	if role == "seller" && locked.Status == dispute.StatusAwaitingSeller {
		if err := locked.Update().AddVersion(1).SetStatus(dispute.StatusUnderReview).Exec(ctx); err != nil {
			return nil, err
		}
		if err := service.recordStatus(ctx, client, locked.ID, string(dispute.StatusUnderReview), "Seller responded — Nantty support is reviewing"); err != nil {
			return nil, err
		}
	}
	return message, container.Outbox.EnqueueInTransaction(ctx, transaction, "disputeMessage.posted", locked.ID.String(), message.CreatedAt, map[string]any{
		"disputeId": locked.ID.String(), "messageId": message.ID.String(), "authorRole": role, "buyerUserId": held.BuyerUserID, "sellerUserId": held.SellerUserID,
	})
}
