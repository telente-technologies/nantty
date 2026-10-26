package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
)

type ChecklistItem struct {
	Key            string  `json:"key"`
	Label          string  `json:"label"`
	Detail         string  `json:"detail"`
	IsVerified     bool    `json:"isVerified"`
	Note           string  `json:"note"`
	VerifiedByName *string `json:"verifiedByName"`
}

type Approval struct {
	AdminId string `json:"adminId"`
	Name    string `json:"name"`
	At      string `json:"at"`
}

type BlackApplicationView struct {
	Id                       string                              `json:"id"`
	User                     accountservices.PlatformUserSummary `json:"user"`
	AgencyName               string                              `json:"agencyName"`
	Handle                   string                              `json:"handle"`
	RepresentativeName       string                              `json:"representativeName"`
	RepresentativeRole       string                              `json:"representativeRole"`
	Status                   string                              `json:"status"`
	SubmittedAt              string                              `json:"submittedAt"`
	Checklist                []ChecklistItem                     `json:"checklist"`
	FirstApproval            *Approval                           `json:"firstApproval"`
	SecondApproval           *Approval                           `json:"secondApproval"`
	DecisionReason           *string                             `json:"decisionReason"`
	ReverificationDueAt      *string                             `json:"reverificationDueAt"`
	ReverificationRemindedAt *string                             `json:"reverificationRemindedAt"`
	HandleReserved           bool                                `json:"handleReserved"`
}

var ChecklistDefinitions = []ChecklistItem{
	{Key: "LETTERHEAD_LETTER", Label: "Official letterhead letter signed by an authorised officer"},
	{Key: "OFFICIAL_CHANNEL", Label: "Confirmed through an official channel (.gov.ng domain or published phone line)"},
	{Key: "REPRESENTATIVE", Label: "Representative ID, BVN or NIN, and proof of role"},
	{Key: "ENTITY_PROOF", Label: "Proof the entity exists (official site or gazette)"},
}

func DecodeChecklist(row *ent.BlackApplication) []ChecklistItem {
	var items []ChecklistItem
	_ = json.Unmarshal(row.Checklist, &items)
	return items
}

func approvalOf(by, name string, at *time.Time) *Approval {
	if at == nil {
		return nil
	}
	return &Approval{AdminId: by, Name: name, At: at.UTC().Format(time.RFC3339)}
}

func BuildBlackApplicationView(ctx context.Context, application *container.Container, row *ent.BlackApplication) (BlackApplicationView, error) {
	target, err := accountservices.LoadTarget(ctx, application, row.AccountID.String())
	if err != nil {
		return BlackApplicationView{}, err
	}
	summary, err := accountservices.BuildPlatformUserSummary(ctx, application, target)
	if err != nil {
		return BlackApplicationView{}, err
	}
	view := BlackApplicationView{
		Id: row.ID.String(), User: summary, AgencyName: row.AgencyName, Handle: row.Handle, RepresentativeName: row.RepresentativeName, RepresentativeRole: row.RepresentativeRole,
		Status: strings.ToUpper(string(row.Status)), SubmittedAt: row.CreatedAt.UTC().Format(time.RFC3339), Checklist: DecodeChecklist(row),
		FirstApproval: approvalOf(row.FirstApprovalBy, row.FirstApprovalByName, row.FirstApprovalAt), SecondApproval: approvalOf(row.SecondApprovalBy, row.SecondApprovalByName, row.SecondApprovalAt),
		HandleReserved: row.HandleReserved,
	}
	if row.DecisionReason != "" {
		view.DecisionReason = &row.DecisionReason
	}
	view.ReverificationDueAt = formatOptional(row.ReverificationDueAt)
	view.ReverificationRemindedAt = formatOptional(row.ReverificationRemindedAt)
	return view, nil
}

func formatOptional(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	formatted := moment.UTC().Format(time.RFC3339)
	return &formatted
}
