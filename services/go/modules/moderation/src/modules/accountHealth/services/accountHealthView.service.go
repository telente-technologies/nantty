package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/copyrightclaim"
	"zudomart/modules/moderation/src/generated/ent/counternotice"
	"zudomart/modules/moderation/src/generated/ent/strike"
)

type ContentReference struct {
	Type string `json:"type"`
	Id   string `json:"id"`
}

type HealthStrikeView struct {
	Id              string            `json:"id"`
	Kind            string            `json:"kind"`
	Policy          string            `json:"policy"`
	Reason          string            `json:"reason"`
	Source          string            `json:"source"`
	IssuedAt        string            `json:"issuedAt"`
	ExpiresAt       *string           `json:"expiresAt"`
	Status          string            `json:"status"`
	AppealStatus    string            `json:"appealStatus"`
	CanAppeal       bool              `json:"canAppeal"`
	ClaimId         *string           `json:"claimId"`
	AffectedContent *ContentReference `json:"affectedContent"`
}

type NoticeView struct {
	ClaimId             string           `json:"claimId"`
	Remedy              string           `json:"remedy"`
	State               string           `json:"state"`
	Content             ContentReference `json:"content"`
	WorkTitle           string           `json:"workTitle"`
	ClaimantName        string           `json:"claimantName"`
	Reason              string           `json:"reason"`
	DecidedAt           string           `json:"decidedAt"`
	DeadlineAt          *string          `json:"deadlineAt"`
	CanCounterNotice    bool             `json:"canCounterNotice"`
	CounterNoticeStatus *string          `json:"counterNoticeStatus"`
}

type HelpLink struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

type AccountHealthView struct {
	AccountId string `json:"accountId"`
	Standing
	ActiveStrikeCount         int                `json:"activeStrikeCount"`
	CopyrightStrikesInWindow  int                `json:"copyrightStrikesInWindow"`
	PendingTakedownCount      int                `json:"pendingTakedownCount"`
	RestrictionThreshold      int                `json:"restrictionThreshold"`
	SuspensionReviewThreshold int                `json:"suspensionReviewThreshold"`
	StrikeWindowDays          int                `json:"strikeWindowDays"`
	StrikeLifetimeDays        int                `json:"strikeLifetimeDays"`
	TakedownDeadlineHours     int                `json:"takedownDeadlineHours"`
	Warnings                  []HealthStrikeView `json:"warnings"`
	Strikes                   []HealthStrikeView `json:"strikes"`
	Notices                   []NoticeView       `json:"notices"`
	HelpLinks                 []HelpLink         `json:"helpLinks"`
	GeneratedAt               string             `json:"generatedAt"`
}

var helpLinks = []HelpLink{
	{Label: "Copyright and account status", Href: "/help/safety-and-reporting/copyright-and-account-status"},
	{Label: "How counter-notices work", Href: "/help/safety-and-reporting/copyright-and-account-status#counter-notices"},
	{Label: "Appealing a strike", Href: "/help/safety-and-reporting/copyright-and-account-status#appeals"},
}

func formatOptional(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	formatted := moment.UTC().Format(time.RFC3339)
	return &formatted
}

func BuildAccountHealth(ctx context.Context, client *ent.Client, accountId uuid.UUID, now time.Time) (AccountHealthView, error) {
	snapshot, err := LoadStanding(ctx, client, accountId, now)
	if err != nil {
		return AccountHealthView{}, err
	}
	claims, err := client.CopyrightClaim.Query().Where(copyrightclaim.InfringerID(accountId), copyrightclaim.RemedyNEQ(copyrightclaim.RemedyNone)).Order(ent.Desc(copyrightclaim.FieldCreatedAt)).Limit(50).All(ctx)
	if err != nil {
		return AccountHealthView{}, err
	}
	claimIds := make([]uuid.UUID, 0, len(claims))
	claimsById := map[string]*ent.CopyrightClaim{}
	for _, claim := range claims {
		claimIds = append(claimIds, claim.ID)
		claimsById[claim.ID.String()] = claim
	}
	notices, err := client.CounterNotice.Query().Where(counternotice.ClaimIDIn(claimIds...)).Order(ent.Asc(counternotice.FieldCreatedAt)).All(ctx)
	if err != nil {
		return AccountHealthView{}, err
	}
	noticeStatus := map[uuid.UUID]string{}
	for _, notice := range notices {
		noticeStatus[notice.ClaimID] = strings.ToUpper(string(notice.Status))
	}
	view := AccountHealthView{
		AccountId: accountId.String(), Standing: snapshot.Standing, ActiveStrikeCount: snapshot.Input.ActiveStrikes, CopyrightStrikesInWindow: snapshot.Input.CopyrightStrikesInWindow,
		PendingTakedownCount: snapshot.Input.PendingTakedowns, RestrictionThreshold: snapshot.Settings.RestrictionThreshold, SuspensionReviewThreshold: snapshot.Settings.SuspensionReviewThreshold,
		StrikeWindowDays: snapshot.Settings.StrikeWindowDays, StrikeLifetimeDays: snapshot.Settings.StrikeLifetimeDays, TakedownDeadlineHours: snapshot.Settings.TakedownDeadlineHours,
		Warnings: []HealthStrikeView{}, Strikes: []HealthStrikeView{}, Notices: []NoticeView{}, HelpLinks: helpLinks, GeneratedAt: now.UTC().Format(time.RFC3339),
	}
	for _, row := range snapshot.Strikes {
		if !IsActiveAt(row, now) && row.AppealStatus != strike.AppealStatusPending {
			continue
		}
		item := buildStrikeItem(row, now, claimsById)
		if row.Kind == strike.KindWarning {
			view.Warnings = append(view.Warnings, item)
		} else {
			view.Strikes = append(view.Strikes, item)
		}
	}
	for _, claim := range claims {
		item := NoticeView{
			ClaimId: claim.ID.String(), Remedy: strings.ToUpper(string(claim.Remedy)), State: strings.ToUpper(string(claim.RemedyState)), Content: ContentReference{Type: string(claim.TargetType), Id: claim.TargetID},
			WorkTitle: claim.WorkTitle, ClaimantName: claimantDisplayName(claim), Reason: decisionReason(claim), DecidedAt: claim.CreatedAt.UTC().Format(time.RFC3339), DeadlineAt: formatOptional(claim.TakedownDeadlineAt),
			CanCounterNotice: claim.Status == copyrightclaim.StatusUpheld && claim.RemedyState != copyrightclaim.RemedyStateRemovedVoluntarily,
		}
		if status, found := noticeStatus[claim.ID]; found {
			item.CounterNoticeStatus = &status
			item.CanCounterNotice = false
		}
		view.Notices = append(view.Notices, item)
	}
	return view, nil
}

func buildStrikeItem(row *ent.Strike, now time.Time, claims map[string]*ent.CopyrightClaim) HealthStrikeView {
	item := HealthStrikeView{
		Id: row.ID.String(), Kind: strings.ToUpper(string(row.Kind)), Policy: row.Policy, Reason: row.Reason, Source: strings.ToUpper(string(row.Source)), IssuedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		ExpiresAt: formatOptional(row.ExpiresAt), Status: strings.ToUpper(IsActiveLabel(row, now)), AppealStatus: strings.ToUpper(string(row.AppealStatus)), CanAppeal: CanAppeal(row, now),
	}
	if row.ReferenceType == "copyright_claim" && row.ReferenceID != "" {
		claimId := row.ReferenceID
		item.ClaimId = &claimId
		if claim, found := claims[claimId]; found {
			item.AffectedContent = &ContentReference{Type: string(claim.TargetType), Id: claim.TargetID}
		}
	}
	return item
}

func IsActiveLabel(row *ent.Strike, now time.Time) string {
	if IsActiveAt(row, now) {
		return "active"
	}
	return "inactive"
}

func CanAppeal(row *ent.Strike, now time.Time) bool {
	return IsActiveAt(row, now) && row.AppealStatus == strike.AppealStatusNone
}

func claimantDisplayName(claim *ent.CopyrightClaim) string {
	if claim.ClaimantOrganization != "" {
		return claim.ClaimantOrganization
	}
	if claim.ClaimantName != "" {
		return claim.ClaimantName
	}
	return "A rights holder"
}

func decisionReason(claim *ent.CopyrightClaim) string {
	if claim.Decision == nil {
		return ""
	}
	var decoded struct {
		Reason string `json:"reason"`
	}
	_ = json.Unmarshal(claim.Decision, &decoded)
	return decoded.Reason
}
