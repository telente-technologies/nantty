package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/businessdocument"
	"nantty/modules/users/src/generated/ent/profilesignal"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
)

type DocumentView struct {
	Id              string  `json:"id"`
	Kind            string  `json:"kind"`
	FileName        string  `json:"fileName"`
	UploadedAt      string  `json:"uploadedAt"`
	Status          string  `json:"status"`
	RejectionReason *string `json:"rejectionReason"`
	ReviewedByName  *string `json:"reviewedByName"`
	ReviewedAt      *string `json:"reviewedAt"`
}

type SubmissionView struct {
	Id            string                              `json:"id"`
	User          accountservices.PlatformUserSummary `json:"user"`
	StoreName     string                              `json:"storeName"`
	Plan          string                              `json:"plan"`
	OverallStatus string                              `json:"overallStatus"`
	SubmittedAt   string                              `json:"submittedAt"`
	Documents     []DocumentView                      `json:"documents"`
	GoldCheckmark string                              `json:"goldCheckmark"`
}

func CurrentDocuments(ctx context.Context, client *ent.Client, accountId uuid.UUID, uploadedOnly bool) ([]*ent.BusinessDocument, error) {
	query := client.BusinessDocument.Query().Where(businessdocument.AccountID(accountId), businessdocument.IsCurrent(true))
	if uploadedOnly {
		query = query.Where(businessdocument.IsUploaded(true))
	}
	return query.Order(ent.Asc(businessdocument.FieldID)).All(ctx)
}

func BuildSubmissionView(ctx context.Context, application *container.Container, accountId uuid.UUID) (SubmissionView, error) {
	target, err := accountservices.LoadTarget(ctx, application, accountId.String())
	if err != nil {
		return SubmissionView{}, err
	}
	summary, err := accountservices.BuildPlatformUserSummary(ctx, application, target)
	if err != nil {
		return SubmissionView{}, err
	}
	documents, err := CurrentDocuments(ctx, application.Client, accountId, true)
	if err != nil {
		return SubmissionView{}, err
	}
	view := SubmissionView{Id: accountId.String(), User: summary, StoreName: summary.DisplayName, Plan: "FREE", OverallStatus: "APPROVED", Documents: []DocumentView{}, GoldCheckmark: "NOT_YET"}
	oldest := time.Time{}
	for _, row := range documents {
		view.Documents = append(view.Documents, documentView(row))
		if oldest.IsZero() || row.CreatedAt.Before(oldest) {
			oldest = row.CreatedAt
		}
		switch row.Status {
		case businessdocument.StatusRejected:
			view.OverallStatus = "REJECTED"
		case businessdocument.StatusPending:
			if view.OverallStatus != "REJECTED" {
				view.OverallStatus = "PENDING"
			}
		}
	}
	if len(documents) < len(DocumentKindOrder) && view.OverallStatus == "APPROVED" {
		view.OverallStatus = "PENDING"
	}
	view.SubmittedAt = oldest.UTC().Format(time.RFC3339)
	return view, decorateWithStore(ctx, application, accountId, &view)
}

func decorateWithStore(ctx context.Context, application *container.Container, accountId uuid.UUID, view *SubmissionView) error {
	store, err := StoreProfileOf(ctx, application.Client, accountId)
	if err != nil || store == nil {
		return err
	}
	view.StoreName = store.DisplayName
	if signals, err := application.Client.ProfileSignal.Query().Where(profilesignal.ProfileID(store.ID)).Only(ctx); err == nil {
		view.Plan = string(signals.SellerPlan)
	} else if !ent.IsNotFound(err) {
		return err
	}
	granted, err := GoldGrantedFor(ctx, application.Client, store.ID)
	if err != nil {
		return err
	}
	switch {
	case granted:
		view.GoldCheckmark = "GRANTED"
	case view.OverallStatus == "APPROVED" && view.Plan == "FREE":
		view.GoldCheckmark = "WAITING_FOR_PLAN"
	}
	return nil
}

func documentView(row *ent.BusinessDocument) DocumentView {
	view := DocumentView{Id: row.ID.String(), Kind: AdminKindNames[string(row.Kind)], FileName: row.FileName, UploadedAt: row.CreatedAt.UTC().Format(time.RFC3339), Status: strings.ToUpper(string(row.Status))}
	if row.RejectionReason != "" {
		view.RejectionReason = &row.RejectionReason
	}
	if row.ReviewedAt != nil {
		reviewed := row.ReviewedAt.UTC().Format(time.RFC3339)
		view.ReviewedAt, view.ReviewedByName = &reviewed, &row.ReviewedByName
	}
	return view
}
