package dtos

type AppealRequest struct {
	Message string `json:"message"`
}

type ReasonRequest struct {
	Reason string `json:"reason"`
}
