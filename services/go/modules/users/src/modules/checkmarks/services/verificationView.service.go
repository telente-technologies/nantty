package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/verificationapplication"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
)

type VerificationView struct {
	Id                       string                              `json:"id"`
	User                     accountservices.PlatformUserSummary `json:"user"`
	Color                    string                              `json:"color"`
	Tier                     string                              `json:"tier"`
	Status                   string                              `json:"status"`
	SubjectKind              string                              `json:"subjectKind"`
	SubmittedAt              string                              `json:"submittedAt"`
	ReviewedAt               *string                             `json:"reviewedAt"`
	ReviewedByName           *string                             `json:"reviewedByName"`
	DecisionReason           *string                             `json:"decisionReason"`
	BadgeVisibleWhenVerified bool                                `json:"badgeVisibleWhenVerified"`
	GrantsDashboardAccess    bool                                `json:"grantsDashboardAccess"`
	Subscription             any                                 `json:"subscription"`
	Applicant                map[string]any                      `json:"applicant"`
	Documents                []VerificationDocument              `json:"documents"`
	Checks                   []any                               `json:"checks"`
	AllowedTransitions       []string                            `json:"allowedTransitions"`
	History                  any                                 `json:"history,omitempty"`
}

var statusLabels = map[verificationapplication.Status]string{
	verificationapplication.StatusPending: "PENDING", verificationapplication.StatusApproved: "VERIFIED", verificationapplication.StatusRejected: "UNVERIFIED",
	verificationapplication.StatusSuspended: "SUSPENDED", verificationapplication.StatusRevoked: "REVOKED",
}

var allowedTransitionsByStatus = map[verificationapplication.Status][]string{
	verificationapplication.StatusPending: {"approve", "reject"}, verificationapplication.StatusApproved: {"suspend", "revoke"},
	verificationapplication.StatusSuspended: {"reinstate", "revoke"}, verificationapplication.StatusRejected: {}, verificationapplication.StatusRevoked: {},
}

func BuildVerificationView(ctx context.Context, application *container.Container, row *ent.VerificationApplication) (VerificationView, error) {
	target, err := accountservices.LoadTarget(ctx, application, row.AccountID.String())
	if err != nil {
		return VerificationView{}, err
	}
	summary, err := accountservices.BuildPlatformUserSummary(ctx, application, target)
	if err != nil {
		return VerificationView{}, err
	}
	applicant := map[string]any{}
	_ = json.Unmarshal(row.Applicant, &applicant)
	applicant["category"] = "PERSONAL"
	if _, present := applicant["agencyName"]; !present {
		applicant["agencyName"], applicant["officialContactEmail"] = nil, nil
	}
	subject := "PERSON"
	if row.Color == verificationapplication.ColorGold {
		subject = "BUSINESS"
	}
	if owner, err := application.Client.Profile.Get(ctx, row.ProfileID); err == nil {
		applicant["category"] = strings.ToUpper(string(owner.ProfileType))
		if owner.ProfileType == profile.ProfileTypeGovernment {
			subject = "GOVERNMENT"
		}
	}
	view := VerificationView{
		Id: row.ID.String(), User: summary, Color: strings.ToUpper(string(row.Color)), Tier: map[verificationapplication.Color]string{verificationapplication.ColorBlue: "VERIFIED", verificationapplication.ColorGold: "PRO"}[row.Color],
		Status: statusLabels[row.Status], SubjectKind: subject, SubmittedAt: row.CreatedAt.UTC().Format(time.RFC3339), BadgeVisibleWhenVerified: true,
		Applicant: applicant, Documents: VerificationDocumentsOf(row), Checks: []any{}, AllowedTransitions: allowedTransitionsByStatus[row.Status],
	}
	if row.ReviewedAt != nil {
		reviewed := row.ReviewedAt.UTC().Format(time.RFC3339)
		view.ReviewedAt, view.ReviewedByName = &reviewed, &row.ReviewedByName
	}
	if row.DecisionReason != "" {
		view.DecisionReason = &row.DecisionReason
	}
	return view, nil
}
