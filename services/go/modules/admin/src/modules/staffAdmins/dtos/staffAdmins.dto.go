package dtos

type CreateAdminRequest struct {
	Email       string   `json:"email"`
	Name        string   `json:"name"`
	Role        string   `json:"role"`
	RoleIds     []string `json:"roleIds"`
	Permissions []string `json:"permissions"`
	Reason      string   `json:"reason"`
}

type ChangePermissionsRequest struct {
	Role        string   `json:"role"`
	RoleIds     []string `json:"roleIds"`
	Permissions []string `json:"permissions"`
	Reason      string   `json:"reason"`
}

type ReasonRequest struct {
	Reason string `json:"reason"`
}

type CreateRoleRequest struct {
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"`
	Reason      string   `json:"reason"`
}

type UpdateStaffSettingsRequest struct {
	RequireSecondSuperadminApproval *bool  `json:"requireSecondSuperadminApproval"`
	Reason                          string `json:"reason"`
}

type UpdateAdminRequest struct {
	IpAllowList *[]string `json:"ipAllowList"`
	Reason      string    `json:"reason"`
}
