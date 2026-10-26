package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/appeal"
	reportservices "nantty/modules/moderation/src/modules/contentReports/services"
)

const SlaWindow = 48 * time.Hour

var decisionTypeByAction = map[string]appeal.DecisionType{
	"HIDE": appeal.DecisionTypeContentRemoved, "REMOVE": appeal.DecisionTypeContentRemoved, "RESTRICT": appeal.DecisionTypeContentRestricted,
	"SUSPEND_AUTHOR": appeal.DecisionTypeSuspension, "WARN_AUTHOR": appeal.DecisionTypeStrike,
}

type OriginalDecision struct {
	Action           string  `json:"action"`
	Reason           string  `json:"reason"`
	DecidedByName    string  `json:"decidedByName"`
	DecidedByStaffId string  `json:"decidedByStaffId"`
	DecidedAt        string  `json:"decidedAt"`
	ReportId         *string `json:"reportId"`
}

type opening struct {
	sourceKey    string
	decisionType appeal.DecisionType
	appellant    uuid.UUID
	report       *ent.ContentReport
	strikeId     *uuid.UUID
	target       reportservices.TargetView
	original     OriginalDecision
	statement    string
}

func IsAppealableAction(action string) bool {
	_, appealable := decisionTypeByAction[action]
	return appealable
}

func ReportDecision(report *ent.ContentReport) (reportservices.Decision, bool) {
	var decision reportservices.Decision
	if report.Decision == nil || json.Unmarshal(report.Decision, &decision) != nil || decision.Action == "" {
		return decision, false
	}
	return decision, true
}

func originalFromReport(report *ent.ContentReport, decision reportservices.Decision) OriginalDecision {
	reportId := report.ID.String()
	return OriginalDecision{Action: decision.Action, Reason: decision.Reason, DecidedByName: decision.DecidedByName, DecidedByStaffId: decision.DecidedByStaffId, DecidedAt: decision.DecidedAt, ReportId: &reportId}
}

func OpenForReport(ctx context.Context, tx *ent.Tx, report *ent.ContentReport, appellant uuid.UUID, linkedStrike *ent.Strike, statement string, now time.Time) (*ent.Appeal, error) {
	decision, _ := ReportDecision(report)
	open := opening{sourceKey: "report:" + report.ID.String(), decisionType: decisionTypeByAction[decision.Action], appellant: appellant, report: report, target: reportservices.BuildTarget(report), original: originalFromReport(report, decision), statement: statement}
	if linkedStrike != nil {
		open.sourceKey, open.strikeId = "strike:"+linkedStrike.ID.String(), &linkedStrike.ID
	}
	return create(ctx, tx, open, now)
}

func OpenForStrike(ctx context.Context, tx *ent.Tx, row *ent.Strike, statement string, now time.Time) (*ent.Appeal, error) {
	open := opening{
		sourceKey: "strike:" + row.ID.String(), decisionType: appeal.DecisionTypeStrike, appellant: row.AccountID, strikeId: &row.ID, statement: statement,
		target:   reportservices.TargetView{Type: "USER", Id: row.AccountID.String(), MediaUrls: []string{}, Visibility: "VISIBLE", CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339)},
		original: OriginalDecision{Action: strings.ToUpper(string(row.Kind)), Reason: row.Reason, DecidedByName: row.IssuedByName, DecidedByStaffId: row.IssuedByID, DecidedAt: row.CreatedAt.UTC().Format(time.RFC3339)},
	}
	if row.Source == "copyright" {
		open.decisionType, open.original.Action = appeal.DecisionTypeCopyrightTakedown, "COPYRIGHT_STRIKE"
		if claimId, err := uuid.Parse(row.ReferenceID); err == nil && row.ReferenceType == "copyright_claim" {
			if claim, err := tx.CopyrightClaim.Get(ctx, claimId); err == nil {
				open.target = copyrightTarget(claim)
			}
		}
	}
	if reportId, err := uuid.Parse(row.ReferenceID); err == nil && row.ReferenceType == "content_report" {
		report, err := tx.ContentReport.Get(ctx, reportId)
		if err != nil && !ent.IsNotFound(err) {
			return nil, err
		}
		if report != nil {
			open.report, open.target = report, reportservices.BuildTarget(report)
			if decision, found := ReportDecision(report); found {
				open.original = originalFromReport(report, decision)
				if mapped, known := decisionTypeByAction[decision.Action]; known {
					open.decisionType = mapped
				}
			}
		}
	}
	return create(ctx, tx, open, now)
}

func copyrightTarget(claim *ent.CopyrightClaim) reportservices.TargetView {
	view := reportservices.TargetView{Type: strings.ToUpper(string(claim.TargetType)), Id: claim.TargetID, MediaUrls: []string{}, Visibility: "VISIBLE", CreatedAt: claim.CreatedAt.UTC().Format(time.RFC3339)}
	if claim.TargetFlag != "visible" {
		view.Visibility = "REMOVED"
	}
	var preview struct {
		Title      *string  `json:"title"`
		Text       *string  `json:"text"`
		MediaUrls  []string `json:"mediaUrls"`
		SoundTitle *string  `json:"soundTitle"`
	}
	if claim.TargetPreview != nil && json.Unmarshal(claim.TargetPreview, &preview) == nil {
		view.Title, view.Text, view.SoundTitle = preview.Title, preview.Text, preview.SoundTitle
		if preview.MediaUrls != nil {
			view.MediaUrls = preview.MediaUrls
		}
	}
	return view
}

func create(ctx context.Context, tx *ent.Tx, open opening, now time.Time) (*ent.Appeal, error) {
	target, _ := json.Marshal(open.target)
	original, _ := json.Marshal(open.original)
	if open.decisionType == "" {
		open.decisionType = appeal.DecisionTypeStrike
	}
	create := tx.Appeal.Create().SetSourceKey(open.sourceKey).SetDecisionType(open.decisionType).SetAppellantID(open.appellant).SetTargetType(strings.ToLower(open.target.Type)).SetTargetID(open.target.Id).
		SetTarget(target).SetOriginalDecision(original).SetStatement(open.statement).SetEvidenceNotes([]string{}).SetSubmittedAt(now).SetSLADueAt(now.Add(SlaWindow)).SetCreatedAt(now).SetNillableStrikeID(open.strikeId)
	if open.report != nil {
		create.SetReportID(open.report.ID)
	}
	return create.Save(ctx)
}
