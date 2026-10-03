package dtos

import "zudomart/modules/live/src/types"

type PostCommentRequest struct {
	Text      string                      `json:"text"`
	Mentions  []types.CommentMentionInput `json:"mentions"`
	ReplyToId string                      `json:"replyToId"`
}

type RoomSettingsRequest struct {
	CommentsEnabled *bool     `json:"commentsEnabled"`
	SlowModeSeconds *int      `json:"slowModeSeconds"`
	BlockedWords    *[]string `json:"blockedWords"`
}

type RestrictionRequest struct {
	DurationMinutes int    `json:"durationMinutes"`
	Reason          string `json:"reason"`
}
