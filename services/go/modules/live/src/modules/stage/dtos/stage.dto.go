package dtos

type InviteGuestRequest struct {
	UserId string `json:"userId"`
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
