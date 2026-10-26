package services

import (
	"context"
	"slices"

	"github.com/google/uuid"

	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccountmember"
	"nantty/platform/httpserver"
)

const (
	PermissionAccountView     = "account:view"
	PermissionAccountManage   = "account:manage"
	PermissionMembersManage   = "members:manage"
	PermissionCampaignsView   = "campaigns:view"
	PermissionCampaignsManage = "campaigns:manage"
	PermissionAudiencesManage = "audiences:manage"
	PermissionReportsView     = "reports:view"
	PermissionBillingView     = "billing:view"
	PermissionBillingManage   = "billing:manage"
	PermissionToolsManage     = "tools:manage"
)

var permissionsByRole = map[string][]string{
	"admin":      {PermissionAccountView, PermissionAccountManage, PermissionMembersManage, PermissionCampaignsView, PermissionCampaignsManage, PermissionAudiencesManage, PermissionReportsView, PermissionBillingView, PermissionBillingManage, PermissionToolsManage},
	"advertiser": {PermissionAccountView, PermissionCampaignsView, PermissionCampaignsManage, PermissionAudiencesManage, PermissionReportsView, PermissionBillingView, PermissionToolsManage},
	"analyst":    {PermissionAccountView, PermissionCampaignsView, PermissionReportsView},
	"billing":    {PermissionAccountView, PermissionCampaignsView, PermissionReportsView, PermissionBillingView, PermissionBillingManage},
}

func RoleHasPermission(role, permission string) bool {
	return slices.Contains(permissionsByRole[role], permission)
}

func RequireAccountPermission(ctx context.Context, client *ent.Client, accountId, userId uuid.UUID, permission string) (*ent.AdAccountMember, error) {
	member, err := client.AdAccountMember.Query().Where(adaccountmember.AccountID(accountId), adaccountmember.UserID(userId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, adserrors.AccountNotFound
	}
	if err != nil {
		return nil, err
	}
	if !RoleHasPermission(string(member.Role), permission) {
		return nil, httpserver.ErrForbidden
	}
	return member, nil
}
