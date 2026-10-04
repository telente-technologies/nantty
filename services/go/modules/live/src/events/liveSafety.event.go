package events

const (
	LiveSafetyPaused     = "liveSafety.paused"
	LiveSafetyResumed    = "liveSafety.resumed"
	LiveSafetyHostNotice = "liveSafety.hostNotice"
	LiveFrameCaptured    = "liveFrame.captured"
	LiveAudioCaptured    = "liveAudio.segmentCaptured"
	ViewerPausedMessage  = "This live is paused while we review it"
)

type LiveSafetyViewerEventData struct {
	LiveId  string `json:"liveId"`
	State   string `json:"state"`
	Message string `json:"message"`
	At      string `json:"at"`
}

type LiveSafetyHostNoticeData struct {
	LiveId     string `json:"liveId"`
	HostId     string `json:"hostId"`
	Kind       string `json:"kind"`
	Category   string `json:"category,omitempty"`
	Message    string `json:"message"`
	IncidentId string `json:"incidentId,omitempty"`
	Appealable bool   `json:"appealable"`
	At         string `json:"at"`
}

type LiveFrameCapturedJob struct {
	FrameId    string `json:"frameId"`
	LiveId     string `json:"liveId"`
	HostId     string `json:"hostId"`
	Bucket     string `json:"bucket"`
	FrameRef   string `json:"frameRef"`
	CapturedAt string `json:"capturedAt"`
	Boosted    bool   `json:"boosted"`
	HoldActive bool   `json:"holdActive"`
}

type LiveAudioSegmentJob struct {
	SegmentId  string `json:"segmentId"`
	LiveId     string `json:"liveId"`
	HostId     string `json:"hostId"`
	Bucket     string `json:"bucket"`
	SegmentRef string `json:"segmentRef"`
	CapturedAt string `json:"capturedAt"`
}
