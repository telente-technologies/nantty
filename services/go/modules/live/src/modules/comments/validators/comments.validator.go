package validators

import (
	"strings"

	"nantty/modules/live/src/modules/comments/dtos"
	"nantty/modules/live/src/utils"
)

func ValidatePostCommentRequest(body dtos.PostCommentRequest) error {
	var collected utils.Issues
	if strings.TrimSpace(body.Text) == "" {
		collected.Add("text", "is required")
	}
	if len(body.Text) > 2000 {
		collected.Add("text", "is too long")
	}
	if len(body.Mentions) > 20 {
		collected.Add("mentions", "at most 20 mentions")
	}
	if body.ReplyToId != "" {
		utils.ParseIdentifiers("replyToId", []string{body.ReplyToId}, &collected)
	}
	return collected.AsError()
}

func ValidateRoomSettingsRequest(body dtos.RoomSettingsRequest) error {
	var collected utils.Issues
	if body.CommentsEnabled == nil && body.SlowModeSeconds == nil && body.BlockedWords == nil && body.CommentAudience == nil {
		collected.Add("commentsEnabled", "send commentsEnabled, slowModeSeconds, blockedWords or commentAudience")
	}
	if body.CommentAudience != nil && !utils.IsCommentAudience(*body.CommentAudience) {
		collected.Add("commentAudience", "must be everyone, followers or subscribers")
	}
	if body.SlowModeSeconds != nil && (*body.SlowModeSeconds < 0 || *body.SlowModeSeconds > 300) {
		collected.Add("slowModeSeconds", "must be between 0 and 300")
	}
	return collected.AsError()
}

func ValidateMuteRequest(body dtos.RestrictionRequest) error {
	var collected utils.Issues
	if body.DurationMinutes < 0 || body.DurationMinutes > 1440 {
		collected.Add("durationMinutes", "must be between 0 and 1440")
	}
	if len(body.Reason) > 200 {
		collected.Add("reason", "must be at most 200 characters")
	}
	return collected.AsError()
}

func ValidateBanRequest(body dtos.RestrictionRequest) error {
	var collected utils.Issues
	if body.DurationMinutes != 0 {
		collected.Add("durationMinutes", "bans last for the rest of the live")
	}
	if len(body.Reason) > 200 {
		collected.Add("reason", "must be at most 200 characters")
	}
	return collected.AsError()
}
