package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
)

const SubjectType = "seller_application"

type MyApplication struct {
	Id                           string     `json:"id"`
	Status                       string     `json:"status"`
	StoreName                    string     `json:"storeName"`
	CategoryName                 string     `json:"categoryName"`
	City                         string     `json:"city"`
	State                        string     `json:"state"`
	IdentityDocumentType         string     `json:"identityDocumentType"`
	IdentityDocumentNumberMasked string     `json:"identityDocumentNumberMasked"`
	PayoutBankName               string     `json:"payoutBankName"`
	PayoutAccountNumberMasked    string     `json:"payoutAccountNumberMasked"`
	SubmittedAt                  time.Time  `json:"submittedAt"`
	ReviewedAt                   *time.Time `json:"reviewedAt"`
	RejectionReason              *string    `json:"rejectionReason"`
}

type EligibilityLine struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	IsMet    bool   `json:"isMet"`
	Actual   string `json:"actual"`
	Required string `json:"required"`
}

type ProgramApplication struct {
	Id                   string            `json:"id"`
	Kind                 string            `json:"kind"`
	User                 map[string]any    `json:"user"`
	Status               string            `json:"status"`
	SubmittedAt          time.Time         `json:"submittedAt"`
	ReviewedAt           *time.Time        `json:"reviewedAt"`
	ReviewedByName       *string           `json:"reviewedByName"`
	DecisionReason       *string           `json:"decisionReason"`
	Pitch                string            `json:"pitch"`
	StoreName            *string           `json:"storeName"`
	Categories           []string          `json:"categories"`
	ExpectedMonthlySales any               `json:"expectedMonthlySales"`
	ContentNiche         *string           `json:"contentNiche"`
	Eligibility          []EligibilityLine `json:"eligibility"`
	IsEligible           bool              `json:"isEligible"`
}

func mask(lastFour string) string { return "******" + lastFour }

func PresentMine(row *ent.SellerApplication) MyApplication {
	view := MyApplication{Id: row.ID.String(), Status: row.Status, StoreName: row.StoreName, CategoryName: row.CategoryName, City: row.City, State: row.State,
		IdentityDocumentType: row.IdentityDocumentType, IdentityDocumentNumberMasked: mask(row.IdentityDocumentLast4), PayoutBankName: row.PayoutBankName,
		PayoutAccountNumberMasked: mask(row.PayoutAccountLast4), SubmittedAt: row.CreatedAt, ReviewedAt: row.ReviewedAt}
	if row.Status == "rejected" {
		view.RejectionReason = row.DecisionReason
	}
	return view
}

func Present(ctx context.Context, deployed *container.Container, rows []*ent.SellerApplication) []ProgramApplication {
	accountIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		accountIds = append(accountIds, row.AccountID)
	}
	people := map[uuid.UUID]map[string]any{}
	if deployed.Identity != nil {
		if found, err := deployed.Identity.UserSummaries(ctx, accountIds); err == nil {
			people = found
		}
	}
	views := make([]ProgramApplication, 0, len(rows))
	for _, row := range rows {
		person, known := people[row.AccountID]
		if !known {
			person = map[string]any{"id": row.AccountID.String(), "username": "", "displayName": "", "avatarUrl": nil, "status": "ACTIVE", "verification": nil}
		}
		categoryActive, _ := deployed.Client.Category.Query().Where(category.ID(row.CategoryID), category.Active(true)).Exist(ctx)
		storeName := row.StoreName
		view := ProgramApplication{Id: row.ID.String(), Kind: "sellers", User: person, Status: strings.ToUpper(row.Status), SubmittedAt: row.CreatedAt,
			ReviewedAt: row.ReviewedAt, ReviewedByName: row.ReviewedByName, DecisionReason: row.DecisionReason, Pitch: row.Description, StoreName: &storeName,
			Categories: []string{row.CategoryName}, Eligibility: eligibility(row, person, categoryActive)}
		view.IsEligible = true
		for _, line := range view.Eligibility {
			view.IsEligible = view.IsEligible && line.IsMet
		}
		views = append(views, view)
	}
	return views
}

func eligibility(row *ent.SellerApplication, person map[string]any, categoryActive bool) []EligibilityLine {
	status, _ := person["status"].(string)
	return []EligibilityLine{
		{Key: "identity_document", Label: "Identity document submitted", IsMet: row.IdentityDocumentLast4 != "", Actual: row.IdentityDocumentType, Required: "Government ID"},
		{Key: "payout_account", Label: "Payout bank account submitted", IsMet: row.PayoutAccountLast4 != "", Actual: mask(row.PayoutAccountLast4), Required: "10-digit account"},
		{Key: "allowed_category", Label: "No prohibited categories", IsMet: categoryActive, Actual: row.CategoryName, Required: "Active marketplace category"},
		{Key: "account_active", Label: "Account active", IsMet: status == "" || strings.EqualFold(status, "ACTIVE"), Actual: status, Required: "ACTIVE"},
	}
}
