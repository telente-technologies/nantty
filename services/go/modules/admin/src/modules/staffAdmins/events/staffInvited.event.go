package events

type StaffInvitedEventData struct {
	StaffId   string `json:"staffId"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	InvitedBy string `json:"invitedBy"`
}
