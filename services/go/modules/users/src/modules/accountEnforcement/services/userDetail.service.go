package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/accountban"
	"nantty/modules/users/src/generated/ent/accountrestriction"
	"nantty/modules/users/src/generated/ent/accountsuspension"
	"nantty/modules/users/src/generated/ent/usernamechange"
	"nantty/modules/users/src/generated/ent/usernamehold"
	"nantty/platform/identityports"
)

type RestrictionView struct {
	Kind      string     `json:"kind"`
	Reason    string     `json:"reason"`
	StartedAt string     `json:"startedAt"`
	EndsAt    *string    `json:"endsAt"`
	Features  []string   `json:"features,omitempty"`
	Id        string     `json:"id,omitempty"`
	LiftedAt  *time.Time `json:"-"`
}

type SessionView struct {
	Id         string `json:"id"`
	Device     string `json:"device"`
	Platform   string `json:"platform"`
	IpAddress  string `json:"ipAddress"`
	Location   string `json:"location"`
	StartedAt  string `json:"startedAt"`
	LastSeenAt string `json:"lastSeenAt"`
}

type UsernameHistoryView struct {
	Id            string `json:"id"`
	FromUsername  string `json:"fromUsername"`
	ToUsername    string `json:"toUsername"`
	Kind          string `json:"kind"`
	ChangedAt     string `json:"changedAt"`
	ChangedByName string `json:"changedByName"`
	Reason        string `json:"reason"`
}

type WithheldUsernameView struct {
	Username                 string `json:"username"`
	OriginalOwnerId          string `json:"originalOwnerId"`
	OriginalOwnerDisplayName string `json:"originalOwnerDisplayName"`
	WithheldAt               string `json:"withheldAt"`
	WithheldByName           string `json:"withheldByName"`
	Reason                   string `json:"reason"`
}

type UserDetail struct {
	User             PlatformUserSummary   `json:"user"`
	Bio              string                `json:"bio"`
	Restriction      *RestrictionView      `json:"restriction"`
	Restrictions     []RestrictionView     `json:"restrictions"`
	Wallet           map[string]any        `json:"wallet"`
	Strikes          []any                 `json:"strikes"`
	Sessions         []SessionView         `json:"sessions"`
	UsernameHistory  []UsernameHistoryView `json:"usernameHistory"`
	WithheldUsername *WithheldUsernameView `json:"withheldUsername"`
	History          []json.RawMessage     `json:"history"`
}

var usernameChangeKinds = map[usernamechange.Reason]string{
	usernamechange.ReasonSignup: "SIGNUP", usernamechange.ReasonUserChange: "USER_CHANGE", usernamechange.ReasonAdminChange: "ASSIGNED_TO_CLAIMANT",
	usernamechange.ReasonAdminReassignedAway: "REASSIGNED_AWAY", usernamechange.ReasonAdminReassignedTo: "REASSIGNED_TO", usernamechange.ReasonAdminAssignedHeld: "ASSIGNED_HELD",
	usernamechange.ReasonAdminWithheld: "WITHHELD", usernamechange.ReasonAdminRestored: "RESTORED", usernamechange.ReasonAdminReclaimedTo: "RECEIVED_FROM_RECLAIM",
}

func formatTime(moment time.Time) string { return moment.UTC().Format(time.RFC3339) }

func BuildUserDetail(ctx context.Context, application *container.Container, target Target) (UserDetail, error) {
	summary, err := BuildPlatformUserSummary(ctx, application, target)
	if err != nil {
		return UserDetail{}, err
	}
	detail := UserDetail{User: summary, Restrictions: []RestrictionView{}, Strikes: []any{}, Sessions: []SessionView{}, UsernameHistory: []UsernameHistoryView{}, History: []json.RawMessage{},
		Wallet: map[string]any{"balances": []any{}, "coinBalance": 0, "pendingWithdrawalCount": 0}}
	if target.Profile != nil {
		detail.Bio = target.Profile.Bio
	}
	if detail.Restriction, err = activeAccountRestriction(ctx, application, target); err != nil {
		return detail, err
	}
	if detail.Restrictions, err = activeFeatureRestrictions(ctx, application, target); err != nil {
		return detail, err
	}
	if enforcement, portErr := identityports.Default.AccountEnforcement(); portErr == nil {
		sessions, err := enforcement.ListActiveAccountSessions(ctx, target.Account.ID)
		if err != nil {
			return detail, err
		}
		for _, session := range sessions {
			detail.Sessions = append(detail.Sessions, SessionView{Id: session.ID.String(), Device: session.UserAgent, Platform: platformOf(session.UserAgent), IpAddress: session.IpAddress, StartedAt: formatTime(session.StartedAt), LastSeenAt: formatTime(session.LastSeenAt)})
		}
	}
	if detail.UsernameHistory, err = usernameHistoryOf(ctx, application, target); err != nil {
		return detail, err
	}
	if detail.WithheldUsername, err = withheldUsernameOf(ctx, application, target); err != nil {
		return detail, err
	}
	if reader, portErr := identityports.Default.AuditHistoryReader(); portErr == nil {
		detail.History, err = reader.ListAuditHistoryForSubject(ctx, "user", target.Account.ID.String(), 50)
	}
	return detail, err
}

func platformOf(userAgent string) string {
	lowered := strings.ToLower(userAgent)
	switch {
	case strings.Contains(lowered, "android"):
		return "ANDROID"
	case strings.Contains(lowered, "iphone"), strings.Contains(lowered, "ios"), strings.Contains(lowered, "darwin"):
		return "IOS"
	}
	return "WEB"
}

func activeAccountRestriction(ctx context.Context, application *container.Container, target Target) (*RestrictionView, error) {
	suspension, err := application.Client.AccountSuspension.Query().Where(accountsuspension.AccountID(target.Account.ID), accountsuspension.StatusEQ(accountsuspension.StatusActive)).Order(ent.Desc(accountsuspension.FieldID)).First(ctx)
	if err == nil {
		view := &RestrictionView{Kind: "SUSPENSION", Reason: suspension.Note, StartedAt: formatTime(suspension.CreatedAt)}
		if suspension.EndsAt != nil {
			ends := formatTime(*suspension.EndsAt)
			view.EndsAt = &ends
		}
		return view, nil
	}
	if !ent.IsNotFound(err) {
		return nil, err
	}
	ban, err := application.Client.AccountBan.Query().Where(accountban.AccountID(target.Account.ID), accountban.LiftedAtIsNil()).Order(ent.Desc(accountban.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	view := &RestrictionView{Kind: "BAN", Reason: ban.Reason, StartedAt: formatTime(ban.CreatedAt)}
	if ban.EndsAt != nil {
		ends := formatTime(*ban.EndsAt)
		view.EndsAt = &ends
	}
	return view, nil
}

func activeFeatureRestrictions(ctx context.Context, application *container.Container, target Target) ([]RestrictionView, error) {
	rows, err := application.Client.AccountRestriction.Query().Where(accountrestriction.AccountID(target.Account.ID), accountrestriction.LiftedAtIsNil(), accountrestriction.EndsAtGT(application.Now())).All(ctx)
	views := make([]RestrictionView, 0, len(rows))
	for _, row := range rows {
		ends := formatTime(row.EndsAt)
		views = append(views, RestrictionView{Kind: "RESTRICTION", Reason: row.Reason, StartedAt: formatTime(row.CreatedAt), EndsAt: &ends, Features: row.Features, Id: row.ID.String()})
	}
	return views, err
}

func usernameHistoryOf(ctx context.Context, application *container.Container, target Target) ([]UsernameHistoryView, error) {
	rows, err := application.Client.UsernameChange.Query().Where(usernamechange.AccountID(target.Account.ID)).Order(ent.Desc(usernamechange.FieldID)).Limit(50).All(ctx)
	views := make([]UsernameHistoryView, 0, len(rows))
	for _, row := range rows {
		views = append(views, UsernameHistoryView{Id: row.ID.String(), FromUsername: row.PreviousUsername, ToUsername: row.NewUsername, Kind: usernameChangeKinds[row.Reason], ChangedAt: formatTime(row.CreatedAt)})
	}
	return views, err
}

func withheldUsernameOf(ctx context.Context, application *container.Container, target Target) (*WithheldUsernameView, error) {
	hold, err := application.Client.UsernameHold.Query().Where(usernamehold.HeldForAccountID(target.Account.ID), usernamehold.KindEQ(usernamehold.KindWithheld)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &WithheldUsernameView{Username: hold.Username, OriginalOwnerId: target.Account.ID.String(), OriginalOwnerDisplayName: target.Account.Name, WithheldAt: formatTime(hold.CreatedAt), WithheldByName: hold.CreatedByName, Reason: hold.Reason}, nil
}
