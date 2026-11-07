package dtos

type InviteGuestRequest struct {
	UserId string `json:"userId"`
	Role   string `json:"role,omitempty"`
	Title  string `json:"title,omitempty"`
}

type MuteRequest struct {
	Audio *bool `json:"audio"`
	Video *bool `json:"video"`
}

type RemoveGuestRequest struct {
	Reason string `json:"reason"`
}

type ConnectionRequest struct {
	Connected *bool `json:"connected"`
}
