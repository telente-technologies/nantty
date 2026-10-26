package createadmin

import "nantty/platform/staffauth"

type Command struct {
	Actor       staffauth.Staff
	Email       string
	Name        string
	Role        string
	RoleIds     []string
	Permissions []string
	Reason      string
}

type Result struct {
	Admin                    any     `json:"admin"`
	InvitationSentTo         *string `json:"invitationSentTo"`
	InvitationExpiresInHours int     `json:"invitationExpiresInHours"`
}
