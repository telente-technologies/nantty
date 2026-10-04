package events

const (
	LiveSafetyHoldType     = "live.safetyHold"
	LiveSafetyReleasedType = "live.safetyReleased"
	LiveSafetyWarningType  = "live.safetyWarning"
	LiveSamplingBoostType  = "live.samplingBoosted"
	LiveModeratorEndedType = "live.moderatorEnded"
)

type LiveSafetyHoldData struct {
	LiveId     string  `json:"liveId"`
	HostId     string  `json:"hostId"`
	IncidentId string  `json:"incidentId"`
	Category   string  `json:"category"`
	Reason     string  `json:"reason"`
	Source     string  `json:"source"`
	Confidence float64 `json:"confidence"`
	HeldAt     string  `json:"heldAt"`
	Appealable bool    `json:"appealable"`
}

type LiveSafetyReleasedData struct {
	LiveId     string `json:"liveId"`
	HostId     string `json:"hostId"`
	IncidentId string `json:"incidentId"`
	ReleasedAt string `json:"releasedAt"`
}

type LiveSafetyWarningData struct {
	LiveId     string `json:"liveId"`
	HostId     string `json:"hostId"`
	IncidentId string `json:"incidentId"`
	Category   string `json:"category"`
	Message    string `json:"message"`
	WarnedAt   string `json:"warnedAt"`
}

type LiveSamplingBoostData struct {
	LiveId     string `json:"liveId"`
	IncidentId string `json:"incidentId"`
	BoostUntil string `json:"boostUntil"`
	Reason     string `json:"reason"`
}

type LiveModeratorEndedData struct {
	LiveId     string `json:"liveId"`
	HostId     string `json:"hostId"`
	IncidentId string `json:"incidentId"`
	Reason     string `json:"reason"`
	Suspended  bool   `json:"suspended"`
	EndedAt    string `json:"endedAt"`
}
