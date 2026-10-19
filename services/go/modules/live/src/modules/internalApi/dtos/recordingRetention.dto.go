package dtos

type RecordingLegalHoldRequest struct {
	Held *bool `json:"held"`
}

type RecordingRepostRequest struct {
	PostId *string `json:"postId"`
}

type RecordingLegalHoldView struct {
	LiveId     string `json:"liveId"`
	Held       bool   `json:"held"`
	Recordings int    `json:"recordings"`
}
