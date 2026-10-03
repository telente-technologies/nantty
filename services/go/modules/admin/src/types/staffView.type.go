package types

import (
	"time"

	"zudomart/modules/admin/src/generated/ent"
)

type StaffView struct {
	Id          string   `json:"id"`
	Email       string   `json:"email"`
	DisplayName string   `json:"displayName"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	Status      string   `json:"status"`
	MfaEnrolled bool     `json:"mfaEnrolled"`
	CreatedAt   string   `json:"createdAt"`
}

func ConvertStaffToView(staff *ent.StaffAccount) StaffView {
	permissions := staff.Permissions
	if permissions == nil {
		permissions = []string{}
	}
	return StaffView{
		Id: staff.ID.String(), Email: staff.Email, DisplayName: staff.DisplayName, Role: string(staff.Role), Permissions: permissions,
		Status: string(staff.Status), MfaEnrolled: staff.TotpConfirmedAt != nil, CreatedAt: staff.CreatedAt.UTC().Format(time.RFC3339),
	}
}
