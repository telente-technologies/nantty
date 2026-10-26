package services

import (
	"context"
	"strings"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
)

type GrantView struct {
	Id            string                              `json:"id"`
	User          accountservices.PlatformUserSummary `json:"user"`
	Color         string                              `json:"color"`
	Reason        string                              `json:"reason"`
	GrantedByName string                              `json:"grantedByName"`
	GrantedAt     string                              `json:"grantedAt"`
	RevokedAt     *string                             `json:"revokedAt"`
	RevokedByName *string                             `json:"revokedByName"`
	RevokedReason *string                             `json:"revokedReason"`
}

func BuildGrantView(ctx context.Context, application *container.Container, row *ent.CheckmarkGrant) (GrantView, error) {
	target, err := accountservices.LoadTarget(ctx, application, row.AccountID.String())
	if err != nil {
		return GrantView{}, err
	}
	summary, err := accountservices.BuildPlatformUserSummary(ctx, application, target)
	if err != nil {
		return GrantView{}, err
	}
	view := GrantView{Id: row.ID.String(), User: summary, Color: strings.ToUpper(string(row.Color)), Reason: row.Reason, GrantedByName: row.GrantedByName, GrantedAt: row.CreatedAt.UTC().Format(time.RFC3339)}
	if row.RevokedAt != nil {
		revokedAt, name, reason := row.RevokedAt.UTC().Format(time.RFC3339), row.RevokedByName, row.RevokedReason
		view.RevokedAt, view.RevokedByName, view.RevokedReason = &revokedAt, &name, &reason
	}
	return view, nil
}
