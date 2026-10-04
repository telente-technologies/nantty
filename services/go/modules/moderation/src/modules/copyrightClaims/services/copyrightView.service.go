package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/counternotice"
	"zudomart/modules/moderation/src/integrations"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
)

type Claimant struct {
	Name             string  `json:"name"`
	Organization     *string `json:"organization"`
	Email            string  `json:"email"`
	RepresentativeOf *string `json:"representativeOf"`
}

type TargetView struct {
	Type       string   `json:"type"`
	Id         string   `json:"id"`
	Title      *string  `json:"title"`
	Text       *string  `json:"text"`
	MediaUrls  []string `json:"mediaUrls"`
	SoundTitle *string  `json:"soundTitle"`
	Visibility string   `json:"visibility"`
	CreatedAt  string   `json:"createdAt"`
}

type Summary struct {
	Id                         string                   `json:"id"`
	Claimant                   Claimant                 `json:"claimant"`
	WorkTitle                  string                   `json:"workTitle"`
	WorkType                   string                   `json:"workType"`
	Target                     TargetView               `json:"target"`
	Infringer                  integrations.UserSummary `json:"infringer"`
	InfringerStrikeCount       int                      `json:"infringerStrikeCount"`
	TargetFlag                 string                   `json:"targetFlag"`
	Status                     string                   `json:"status"`
	FiledAt                    string                   `json:"filedAt"`
	TopAudioMatchConfidencePct *int                     `json:"topAudioMatchConfidencePercent"`
	ClaimScope                 string                   `json:"claimScope"`
	Remedy                     string                   `json:"remedy"`
	RemedyState                string                   `json:"remedyState"`
	TakedownDeadlineAt         *string                  `json:"takedownDeadlineAt"`
}

type ClaimEvidenceView struct {
	OriginalWorkUrl     *string           `json:"originalWorkUrl"`
	OriginalWorkMediaId *string           `json:"originalWorkMediaId"`
	ProofUrls           []string          `json:"proofUrls"`
	ProofMediaIds       []string          `json:"proofMediaIds"`
	Segments            []json.RawMessage `json:"segments"`
	AccuracyDeclared    bool              `json:"accuracyDeclared"`
	SignatureName       string            `json:"signatureName"`
	SignedAt            *string           `json:"signedAt"`
	ClaimantPhone       *string           `json:"claimantPhone"`
	ClaimantAddress     *string           `json:"claimantAddress"`
}

type CounterNoticeView struct {
	Id                  string `json:"id"`
	SubmittedAt         string `json:"submittedAt"`
	Statement           string `json:"statement"`
	Status              string `json:"status"`
	RestoreEligibleAt   string `json:"restoreEligibleAt"`
	CourtActionRecorded bool   `json:"courtActionRecorded"`
}

type Detail struct {
	Summary
	RightsBasis              string              `json:"rightsBasis"`
	SwornStatement           string              `json:"swornStatement"`
	ClaimedUrls              []string            `json:"claimedUrls"`
	AudioMatches             []json.RawMessage   `json:"audioMatches"`
	CounterNotices           []CounterNoticeView `json:"counterNotices"`
	Evidence                 ClaimEvidenceView   `json:"evidence"`
	RepeatInfringerThreshold int                 `json:"repeatInfringerThreshold"`
	IsRepeatInfringer        bool                `json:"isRepeatInfringer"`
	Decision                 json.RawMessage     `json:"decision"`
	History                  []json.RawMessage   `json:"history"`
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func BuildSummaries(ctx context.Context, c *container.Container, rows []*ent.CopyrightClaim) ([]Summary, error) {
	ids := []uuid.UUID{}
	for _, row := range rows {
		if row.InfringerID != nil {
			ids = append(ids, *row.InfringerID)
		}
	}
	users, counts := map[string]integrations.UserSummary{}, map[uuid.UUID]strikeservices.Counts{}
	if len(ids) > 0 {
		var err error
		if users, err = c.Users.Summaries(ctx, ids); err != nil {
			return nil, err
		}
		if counts, err = strikeservices.ActiveCounts(ctx, c.Client, c.Now(), ids); err != nil {
			return nil, err
		}
	}
	summaries := make([]Summary, 0, len(rows))
	for _, row := range rows {
		target := TargetView{Type: strings.ToUpper(string(row.TargetType)), Id: row.TargetID, MediaUrls: []string{}, Visibility: visibilityFor(row), CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339)}
		var preview integrations.TargetPreview
		if row.TargetPreview != nil && json.Unmarshal(row.TargetPreview, &preview) == nil {
			target.Title, target.Text, target.SoundTitle = preview.Title, preview.Text, preview.SoundTitle
			if preview.MediaUrls != nil {
				target.MediaUrls = preview.MediaUrls
			}
		}
		summary := Summary{
			Id: row.ID.String(), Claimant: Claimant{Name: row.ClaimantName, Organization: optional(row.ClaimantOrganization), Email: row.ClaimantEmail, RepresentativeOf: optional(row.Represents)},
			WorkTitle: row.WorkTitle, WorkType: strings.ToUpper(string(row.WorkType)), Target: target, TargetFlag: strings.ToUpper(string(row.TargetFlag)), Status: strings.ToUpper(string(row.Status)),
			FiledAt: row.CreatedAt.UTC().Format(time.RFC3339), TopAudioMatchConfidencePct: row.TopAudioMatchPercent,
			ClaimScope: strings.ToUpper(string(row.ClaimScope)), Remedy: strings.ToUpper(string(row.Remedy)), RemedyState: strings.ToUpper(string(row.RemedyState)), TakedownDeadlineAt: formatTime(row.TakedownDeadlineAt),
		}
		if row.InfringerID != nil {
			summary.Infringer = users[row.InfringerID.String()]
			summary.InfringerStrikeCount = counts[*row.InfringerID].ActiveStrikes
		}
		summaries = append(summaries, summary)
	}
	return summaries, nil
}

func visibilityFor(row *ent.CopyrightClaim) string {
	return map[string]string{"visible": "VISIBLE", "limited": "RESTRICTED", "taken_down": "REMOVED", "muted": "VISIBLE", "warned": "VISIBLE"}[string(row.TargetFlag)]
}

func formatTime(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	formatted := moment.UTC().Format(time.RFC3339)
	return &formatted
}

func buildEvidence(row *ent.CopyrightClaim) ClaimEvidenceView {
	evidence := ClaimEvidenceView{
		OriginalWorkUrl: optional(row.OriginalWorkURL), OriginalWorkMediaId: optional(row.OriginalWorkMediaID), ProofUrls: row.ProofUrls, ProofMediaIds: row.ProofMediaIds, Segments: []json.RawMessage{},
		AccuracyDeclared: row.AccuracyDeclared, SignatureName: row.SignatureName, SignedAt: formatTime(row.SignedAt), ClaimantPhone: optional(row.ClaimantPhone), ClaimantAddress: optional(row.ClaimantAddress),
	}
	if row.InfringingSegments != nil {
		_ = json.Unmarshal(row.InfringingSegments, &evidence.Segments)
	}
	return evidence
}

func BuildDetail(ctx context.Context, c *container.Container, row *ent.CopyrightClaim) (Detail, error) {
	summaries, err := BuildSummaries(ctx, c, []*ent.CopyrightClaim{row})
	if err != nil {
		return Detail{}, err
	}
	detail := Detail{Summary: summaries[0], RightsBasis: row.RightsBasis, SwornStatement: row.SwornStatement, ClaimedUrls: row.ClaimedUrls, AudioMatches: []json.RawMessage{}, CounterNotices: []CounterNoticeView{},
		RepeatInfringerThreshold: strikeservices.RepeatInfringerThreshold, IsRepeatInfringer: strikeservices.IsRepeatInfringer(summaries[0].InfringerStrikeCount), Decision: row.Decision, Evidence: buildEvidence(row)}
	if row.AudioMatches != nil {
		_ = json.Unmarshal(row.AudioMatches, &detail.AudioMatches)
	}
	notices, err := c.Client.CounterNotice.Query().Where(counternotice.ClaimID(row.ID)).Order(ent.Asc(counternotice.FieldCreatedAt)).All(ctx)
	if err != nil {
		return Detail{}, err
	}
	for _, notice := range notices {
		detail.CounterNotices = append(detail.CounterNotices, CounterNoticeView{Id: notice.ID.String(), SubmittedAt: notice.CreatedAt.UTC().Format(time.RFC3339), Statement: notice.Statement, Status: strings.ToUpper(string(notice.Status)),
			RestoreEligibleAt: notice.RestoreEligibleAt.UTC().Format(time.RFC3339), CourtActionRecorded: notice.CourtActionRecorded})
	}
	if detail.History, err = c.Audit.History(ctx, "copyright_claim", row.ID.String()); err != nil {
		return Detail{}, err
	}
	return detail, nil
}
