package dtos

type TipRequestDto struct {
	TargetType string `json:"targetType"`
	TargetId   string `json:"targetId"`
	Coins      int64  `json:"coins"`
	Note       string `json:"note,omitempty"`
}
