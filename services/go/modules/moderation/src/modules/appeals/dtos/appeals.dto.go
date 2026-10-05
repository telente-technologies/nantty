package dtos

type DecideRequest struct {
	Outcome string `json:"outcome"`
	Reason  string `json:"reason"`
}

type AppealRequest struct {
	Message string `json:"message"`
}
