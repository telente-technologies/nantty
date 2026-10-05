package dtos

import (
	"time"

	escrowdtos "zudomart/modules/escrow/src/modules/escrows/dtos"
	ledgerrepositories "zudomart/modules/ledger/src/repositories"
)

type StaffDisputeSummaryDto struct {
	Id            string                          `json:"id"`
	OrderId       string                          `json:"orderId"`
	OrderNumber   string                          `json:"orderNumber"`
	ProductName   string                          `json:"productName"`
	Buyer         ledgerrepositories.PartySummary `json:"buyer"`
	Seller        ledgerrepositories.PartySummary `json:"seller"`
	Store         ledgerrepositories.StoreSummary `json:"store"`
	Reason        string                          `json:"reason"`
	Status        string                          `json:"status"`
	Priority      string                          `json:"priority"`
	EscrowAmount  escrowdtos.MoneyDto             `json:"escrowAmount"`
	OpenedAt      time.Time                       `json:"openedAt"`
	SlaDueAt      *time.Time                      `json:"slaDueAt"`
	IsSlaBreached bool                            `json:"isSlaBreached"`
}

type StaffDisputeEscrowDto struct {
	EscrowId         string              `json:"escrowId"`
	Status           string              `json:"status"`
	Amount           escrowdtos.MoneyDto `json:"amount"`
	HeldAmount       escrowdtos.MoneyDto `json:"heldAmount"`
	RefundedAmount   escrowdtos.MoneyDto `json:"refundedAmount"`
	ReleasedAmount   escrowdtos.MoneyDto `json:"releasedAmount"`
	Commission       escrowdtos.MoneyDto `json:"commission"`
	ProcessingFee    escrowdtos.MoneyDto `json:"processingFee"`
	PaymentReference string              `json:"paymentReference"`
	DeliveredAt      *time.Time          `json:"deliveredAt"`
}

type DisputeResolutionDto struct {
	Outcome           string              `json:"outcome"`
	BuyerRefund       escrowdtos.MoneyDto `json:"buyerRefund"`
	SellerPayout      escrowdtos.MoneyDto `json:"sellerPayout"`
	Commission        escrowdtos.MoneyDto `json:"commission"`
	Note              string              `json:"note"`
	ResolvedAt        *time.Time          `json:"resolvedAt"`
	ResolvedByStaffId *string             `json:"resolvedByStaffId"`
}

type StaffDisputeDetailDto struct {
	StaffDisputeSummaryDto
	Description           string                  `json:"description"`
	EvidenceUrls          []string                `json:"evidenceUrls"`
	SellerResponse        *string                 `json:"sellerResponse"`
	CommissionBasisPoints int64                   `json:"commissionBasisPoints"`
	Escrow                StaffDisputeEscrowDto   `json:"escrow"`
	Resolution            *DisputeResolutionDto   `json:"resolution"`
	Messages              []DisputeMessageDto     `json:"messages"`
	History               []DisputeStatusEventDto `json:"history"`
}

type StaffDisputeListDto struct {
	Data       []StaffDisputeSummaryDto `json:"data"`
	NextCursor *string                  `json:"nextCursor"`
	Counts     map[string]int           `json:"counts"`
}
