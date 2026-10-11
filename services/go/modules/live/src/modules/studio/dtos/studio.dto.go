package dtos

type RecordingSettingRequest struct {
	Enabled *bool `json:"enabled"`
}

type HostDefaultsRequest struct {
	CommentsEnabled *bool     `json:"commentsEnabled"`
	CommentAudience *string   `json:"commentAudience"`
	SlowModeSeconds *int      `json:"slowModeSeconds"`
	BlockedWords    *[]string `json:"blockedWords"`
	ModeratorIds    *[]string `json:"moderatorIds"`
}
