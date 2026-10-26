package services

import (
	"context"
	"strings"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
)

type AdminCreatedAccountView struct {
	Id                      string                              `json:"id"`
	User                    accountservices.PlatformUserSummary `json:"user"`
	ProfileType             string                              `json:"profileType"`
	CreatedAt               string                              `json:"createdAt"`
	CreatedByName           string                              `json:"createdByName"`
	Reason                  string                              `json:"reason"`
	MustChangePassword      bool                                `json:"mustChangePassword"`
	BypassedReservedEntries []string                            `json:"bypassedReservedEntries"`
}

func BuildAdminCreatedAccountView(ctx context.Context, application *container.Container, row *ent.AdminCreatedAccount) (AdminCreatedAccountView, error) {
	target, err := accountservices.LoadTarget(ctx, application, row.AccountID.String())
	if err != nil {
		return AdminCreatedAccountView{}, err
	}
	summary, err := accountservices.BuildPlatformUserSummary(ctx, application, target)
	if err != nil {
		return AdminCreatedAccountView{}, err
	}
	bypassed := row.BypassedReservedEntries
	if bypassed == nil {
		bypassed = []string{}
	}
	return AdminCreatedAccountView{
		Id: row.ID.String(), User: summary, ProfileType: strings.ToUpper(string(row.ProfileType)), CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		CreatedByName: row.CreatedByName, Reason: row.Reason, MustChangePassword: true, BypassedReservedEntries: bypassed,
	}, nil
}
