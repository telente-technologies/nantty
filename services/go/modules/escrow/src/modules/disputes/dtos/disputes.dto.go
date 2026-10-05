package dtos

import (
	"time"

	escrowdtos "zudomart/modules/escrow/src/modules/escrows/dtos"
)

type OpenDisputeRequestDto struct {
	Reason       string   `json:"reason"`
	Description  string   `json:"description"`
	EvidenceUrls []string `json:"evidenceUrls"`
}

type DisputeMessageRequestDto struct {
	Text           string   `json:"text"`
	AttachmentUrls []string `json:"attachmentUrls"`
}

type ResolveDisputeRequestDto struct {
	Outcome           string               `json:"outcome"`
	Note              string               `json:"note,omitempty"`
	Reason            string               `json:"reason,omitempty"`
	RefundAmountMinor int64                `json:"refundAmountMinor,omitempty"`
	RefundAmount      *escrowdtos.MoneyDto `json:"refundAmount,omitempty"`
}

type DisputeMessageDto struct {
	Id              string    `json:"id"`
	AuthorRole      string    `json:"authorRole"`
	AuthorName      string    `json:"authorName"`
	AuthorAvatarUrl *string   `json:"authorAvatarUrl"`
	Text            string    `json:"text"`
	AttachmentUrls  []string  `json:"attachmentUrls"`
	CreatedAt       time.Time `json:"createdAt"`
}

type DisputeStatusEventDto struct {
	Status     string    `json:"status"`
	Label      string    `json:"label"`
	OccurredAt time.Time `json:"occurredAt"`
}

type DisputeDto struct {
	Id               string                  `json:"id"`
	OrderId          string                  `json:"orderId"`
	OrderReference   string                  `json:"orderReference"`
	ProductName      string                  `json:"productName"`
	Amount           escrowdtos.MoneyDto     `json:"amount"`
	RefundAmount     escrowdtos.MoneyDto     `json:"refundAmount"`
	Reason           string                  `json:"reason"`
	Description      string                  `json:"description"`
	EvidenceUrls     []string                `json:"evidenceUrls"`
	Status           string                  `json:"status"`
	ViewerRole       string                  `json:"viewerRole"`
	CounterpartyName string                  `json:"counterpartyName"`
	OpenedAt         time.Time               `json:"openedAt"`
	RespondByAt      *time.Time              `json:"respondByAt"`
	ResolutionNote   *string                 `json:"resolutionNote"`
	StatusHistory    []DisputeStatusEventDto `json:"statusHistory"`
	Messages         []DisputeMessageDto     `json:"messages"`
}
