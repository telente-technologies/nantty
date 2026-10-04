package types

type LiveSafetyView struct {
	State          string  `json:"state"`
	ViewerMessage  string  `json:"viewerMessage"`
	HeldAt         *string `json:"heldAt"`
	HostReason     *string `json:"hostReason,omitempty"`
	Category       *string `json:"category,omitempty"`
	Appealable     bool    `json:"appealable"`
	WarningMessage *string `json:"warningMessage,omitempty"`
	WarnedAt       *string `json:"warnedAt,omitempty"`
}

type LiveSafetyHoldCommand struct {
	LiveId     string
	IncidentId string
	Category   string
	Reason     string
	Source     string
}
