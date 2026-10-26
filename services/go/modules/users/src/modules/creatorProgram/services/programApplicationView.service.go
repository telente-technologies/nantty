package services

import (
	"context"
	"strings"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/creatorapplication"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
)

type EligibilityLine struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	IsMet    bool   `json:"isMet"`
	Actual   int    `json:"actual"`
	Required int    `json:"required"`
}

type ProgramApplication struct {
	Id                   string                              `json:"id"`
	Kind                 string                              `json:"kind"`
	User                 accountservices.PlatformUserSummary `json:"user"`
	Status               string                              `json:"status"`
	SubmittedAt          string                              `json:"submittedAt"`
	ReviewedAt           *string                             `json:"reviewedAt"`
	ReviewedByName       *string                             `json:"reviewedByName"`
	DecisionReason       *string                             `json:"decisionReason"`
	Pitch                string                              `json:"pitch"`
	StoreName            *string                             `json:"storeName"`
	Categories           []string                            `json:"categories"`
	ExpectedMonthlySales *struct{}                           `json:"expectedMonthlySales"`
	ContentNiche         string                              `json:"contentNiche"`
	Eligibility          []EligibilityLine                   `json:"eligibility"`
	IsEligible           bool                                `json:"isEligible"`
	Decision             string                              `json:"decision"`
	DecisionNote         string                              `json:"decisionNote"`
	History              any                                 `json:"history,omitempty"`
}

func BuildProgramApplication(ctx context.Context, application *container.Container, row *ent.CreatorApplication) (ProgramApplication, error) {
	target, err := accountservices.LoadTarget(ctx, application, row.AccountID.String())
	if err != nil {
		return ProgramApplication{}, err
	}
	summary, err := accountservices.BuildPlatformUserSummary(ctx, application, target)
	if err != nil {
		return ProgramApplication{}, err
	}
	lines := []EligibilityLine{}
	for _, requirement := range RequirementsOfApplication(row) {
		lines = append(lines, EligibilityLine{Key: requirement.Key, Label: requirement.Label, IsMet: requirement.Met, Actual: requirement.CurrentValue, Required: requirement.RequiredValue})
	}
	view := ProgramApplication{
		Id: row.ID.String(), Kind: "creators", User: summary, Status: strings.ToUpper(string(row.Status)), SubmittedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		ReviewedAt: formatOptional(row.ReviewedAt), Pitch: row.DecisionNote, Categories: row.ContentCategories, ContentNiche: strings.Join(row.ContentCategories, ", "),
		Eligibility: lines, IsEligible: row.Decision != creatorapplication.DecisionNotEligible, Decision: string(row.Decision), DecisionNote: row.DecisionNote,
	}
	if view.Categories == nil {
		view.Categories = []string{}
	}
	if row.ReviewedByName != "" {
		view.ReviewedByName = &row.ReviewedByName
	}
	if row.DecisionReason != "" {
		view.DecisionReason = &row.DecisionReason
	}
	return view, nil
}
