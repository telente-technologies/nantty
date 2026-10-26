package withholdaccountusername

import (
	"nantty/modules/users/src/modules/accountEnforcement/services"
	"nantty/modules/users/src/types"
)

type Command struct {
	Actor    types.StaffActor
	TargetId string
	Reason   string
}

type NotificationPreview struct {
	Channel string `json:"channel"`
	Title   string `json:"title"`
	Body    string `json:"body"`
}

type Result struct {
	User             services.PlatformUserSummary  `json:"user"`
	WithheldUsername services.WithheldUsernameView `json:"withheldUsername"`
	AssignedUsername string                        `json:"assignedUsername"`
	Notification     NotificationPreview           `json:"notification"`
}
