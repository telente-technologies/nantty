package types

import (
	"strings"
	"time"

	"nantty/modules/admin/src/generated/ent"
)

type StaffView struct {
	Id             string   `json:"id"`
	Email          string   `json:"email"`
	DisplayName    string   `json:"displayName"`
	Name           string   `json:"name"`
	Role           string   `json:"role"`
	Permissions    []string `json:"permissions"`
	Status         string   `json:"status"`
	MfaEnrolled    bool     `json:"mfaEnrolled"`
	PasskeyCount   int      `json:"passkeyCount"`
	LastLoginAt    *string  `json:"lastLoginAt"`
	CreatedAt      string   `json:"createdAt"`
	CreatedByName  string   `json:"createdByName"`
	ApprovedByName *string  `json:"approvedByName"`
	RoleIds        []string `json:"roleIds"`
	RoleNames      []string `json:"roleNames"`
	IpAllowList    []string `json:"ipAllowList"`
}

func ConvertStaffToView(staff *ent.StaffAccount) StaffView {
	permissions := staff.Permissions
	if permissions == nil {
		permissions = []string{}
	}
	roleIds := staff.RoleIds
	if roleIds == nil {
		roleIds = []string{}
	}
	ipAllowList := staff.IPAllowList
	if ipAllowList == nil {
		ipAllowList = []string{}
	}
	return StaffView{
		Id: staff.ID.String(), Email: staff.Email, DisplayName: staff.DisplayName, Name: staff.DisplayName, Role: strings.ToUpper(string(staff.Role)), Permissions: permissions,
		Status: strings.ToUpper(string(staff.Status)), MfaEnrolled: staff.TotpConfirmedAt != nil, CreatedAt: staff.CreatedAt.UTC().Format(time.RFC3339),
		RoleIds: roleIds, RoleNames: []string{}, IpAllowList: ipAllowList,
	}
}
