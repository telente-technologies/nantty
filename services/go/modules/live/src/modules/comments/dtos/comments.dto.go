package dtos

import "nantty/modules/live/src/types"

type PostCommentRequest struct {
	Text      string                      `json:"text"`
	Mentions  []types.CommentMentionInput `json:"mentions"`
	ReplyToId string                      `json:"replyToId"`
}

type RoomSettingsRequest struct {
	CommentsEnabled *bool     `json:"commentsEnabled"`
	SlowModeSeconds *int      `json:"slowModeSeconds"`
	BlockedWords    *[]string `json:"blockedWords"`
	CommentAudience *string   `json:"commentAudience"`
}

type RestrictionRequest struct {
	DurationMinutes int    `json:"durationMinutes"`
	Reason          string `json:"reason"`
}
