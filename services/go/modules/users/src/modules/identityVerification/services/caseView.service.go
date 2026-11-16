package services

import (
	"time"

	"nantty/modules/users/src/generated/ent"
)

type ChecksView struct {
	Liveness            string  `json:"liveness"`
	Document            string  `json:"document"`
	FaceMatch           string  `json:"faceMatch"`
	DatabaseLookup      string  `json:"databaseLookup"`
	FaceMatchConfidence float64 `json:"faceMatchConfidence"`
	NameMatchScore      float64 `json:"nameMatchScore"`
}

type CaseView struct {
	Id                string     `json:"id"`
	ProfileId         string     `json:"profileId"`
	AccountId         string     `json:"accountId"`
	Color             string     `json:"color"`
	PlanCode          string     `json:"planCode"`
	PaymentChannel    string     `json:"paymentChannel"`
	Status            string     `json:"status"`
	RefundStatus      string     `json:"refundStatus"`
	RefundMethod      string     `json:"refundMethod"`
	RefundScope       string     `json:"refundScope"`
	ConsentGiven      bool       `json:"consentGiven"`
	DocumentType      string     `json:"documentType"`
	DocumentCountry   string     `json:"documentCountry"`
	Checks            ChecksView `json:"checks"`
	TrustScore        int        `json:"trustScore"`
	EligibleAtPayment bool       `json:"eligibleAtPayment"`
	DecisionReasons   []string   `json:"decisionReasons"`
	FraudSignals      []string   `json:"fraudSignals"`
	DecisionReason    string     `json:"decisionReason"`
	DecidedByName     string     `json:"decidedByName,omitempty"`
	SmileReference    string     `json:"smileReference,omitempty"`
	SmileResultCode   string     `json:"smileResultCode,omitempty"`
	CreatedAt         string     `json:"createdAt"`
	DecidedAt         *string    `json:"decidedAt"`
	VerifiedAt        *string    `json:"verifiedAt"`
	CanRetry          bool       `json:"canRetry"`
}

func ConvertCaseToView(row *ent.VerificationCase, includeReviewDetail bool) CaseView {
	view := CaseView{
		Id: row.ID.String(), ProfileId: row.ProfileID.String(), AccountId: row.AccountID.String(), Color: string(row.Color), PlanCode: row.PlanCode,
		PaymentChannel: row.PaymentChannel, Status: string(row.Status), RefundStatus: string(row.RefundStatus), ConsentGiven: row.ConsentAt != nil,
		RefundMethod: RefundMethodFor(row.PaymentChannel, RefundsOnRejection(row.PlanCode)), RefundScope: RefundScopeFor(row.PlanCode),
		DocumentType: row.DocumentType, DocumentCountry: row.DocumentCountry, DecisionReason: row.DecisionReason, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		DecidedAt: optionalTime(row.DecidedAt), VerifiedAt: optionalTime(row.VerifiedAt), DecisionReasons: []string{}, FraudSignals: []string{},
		CanRetry: row.Status == "awaiting_capture" || row.Status == "awaiting_consent",
		Checks:   ChecksView{Liveness: row.LivenessResult, Document: row.DocumentResult, FaceMatch: row.FaceMatchResult, DatabaseLookup: row.DatabaseResult},
	}
	if !includeReviewDetail {
		return view
	}
	view.Checks.FaceMatchConfidence, view.Checks.NameMatchScore = row.FaceMatchConfidence, row.NameMatchScore
	view.TrustScore, view.EligibleAtPayment, view.DecidedByName = row.TrustScore, row.EligibleAtPayment, row.DecidedByName
	view.DecisionReasons, view.FraudSignals = nonNilStrings(row.DecisionReasons), nonNilStrings(row.FraudSignals)
	view.SmileReference, view.SmileResultCode = row.SmileReference, row.SmileResultCode
	return view
}

func optionalTime(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.UTC().Format(time.RFC3339)
	return &formatted
}
