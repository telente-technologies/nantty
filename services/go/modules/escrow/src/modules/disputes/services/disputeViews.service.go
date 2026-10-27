package services

import (
	"context"
	"encoding/json"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/disputemessage"
	"nantty/modules/escrow/src/generated/ent/disputestatusevent"
	"nantty/modules/escrow/src/modules/disputes/dtos"
	escrowdtos "nantty/modules/escrow/src/modules/escrows/dtos"
)

var authorNameByRole = map[string]string{"buyer": "Buyer", "seller": "Seller", "support": "Nantty support"}

func LoadDisputeView(ctx context.Context, client *ent.Client, found *ent.Dispute, held *ent.Escrow, viewerRole string) (dtos.DisputeDto, error) {
	statusEvents, err := client.DisputeStatusEvent.Query().Where(disputestatusevent.DisputeID(found.ID)).Order(ent.Asc(disputestatusevent.FieldCreatedAt), ent.Asc(disputestatusevent.FieldID)).All(ctx)
	if err != nil {
		return dtos.DisputeDto{}, err
	}
	messages, err := client.DisputeMessage.Query().Where(disputemessage.DisputeID(found.ID)).Order(ent.Asc(disputemessage.FieldCreatedAt), ent.Asc(disputemessage.FieldID)).All(ctx)
	if err != nil {
		return dtos.DisputeDto{}, err
	}
	view := dtos.DisputeDto{
		Id: found.ID.String(), OrderId: found.OrderID, OrderReference: held.OrderReference, ProductName: held.ProductSummary,
		Amount:       escrowdtos.MoneyDto{AmountMinor: held.AmountMinor, Currency: held.Currency},
		RefundAmount: escrowdtos.MoneyDto{AmountMinor: found.RefundAmountMinor, Currency: held.Currency},
		Reason:       string(found.Reason), Description: found.Description, Status: string(found.Status), ViewerRole: viewerRole,
		CounterpartyName: authorNameByRole[map[string]string{"buyer": "seller", "seller": "buyer"}[viewerRole]],
		OpenedAt:         found.CreatedAt, RespondByAt: found.RespondByAt,
		StatusHistory: []dtos.DisputeStatusEventDto{}, Messages: []dtos.DisputeMessageDto{},
	}
	_ = json.Unmarshal(found.EvidenceUrls, &view.EvidenceUrls)
	if view.EvidenceUrls == nil {
		view.EvidenceUrls = []string{}
	}
	if found.ResolutionNote != "" {
		note := found.ResolutionNote
		view.ResolutionNote = &note
	}
	for _, event := range statusEvents {
		view.StatusHistory = append(view.StatusHistory, dtos.DisputeStatusEventDto{Status: event.Status, Label: event.Label, OccurredAt: event.CreatedAt})
	}
	for _, message := range messages {
		converted := dtos.DisputeMessageDto{Id: message.ID.String(), AuthorRole: string(message.AuthorRole), AuthorName: authorNameByRole[string(message.AuthorRole)], Text: message.Text, CreatedAt: message.CreatedAt}
		_ = json.Unmarshal(message.AttachmentUrls, &converted.AttachmentUrls)
		if converted.AttachmentUrls == nil {
			converted.AttachmentUrls = []string{}
		}
		view.Messages = append(view.Messages, converted)
	}
	return view, nil
}

func ConvertDisputeMessage(message *ent.DisputeMessage) dtos.DisputeMessageDto {
	converted := dtos.DisputeMessageDto{Id: message.ID.String(), AuthorRole: string(message.AuthorRole), AuthorName: authorNameByRole[string(message.AuthorRole)], Text: message.Text, CreatedAt: message.CreatedAt}
	_ = json.Unmarshal(message.AttachmentUrls, &converted.AttachmentUrls)
	if converted.AttachmentUrls == nil {
		converted.AttachmentUrls = []string{}
	}
	return converted
}
