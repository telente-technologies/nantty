package dtos

type AppealRequest struct {
	Message string `json:"message"`
}

type ReasonRequest struct {
	Reason string `json:"reason"`
}

type MonetisationOverrideRequest struct {
	Mode   string `json:"mode"`
	Reason string `json:"reason"`
}
