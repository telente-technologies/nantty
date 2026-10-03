package dtos

type InviteStaffRequest struct {
	Email       string   `json:"email"`
	DisplayName string   `json:"displayName"`
	Permissions []string `json:"permissions"`
}

type ChangePermissionsRequest struct {
	Permissions []string `json:"permissions"`
}
